// Direct Web Bluetooth & Web Serial printing for NIIMBOT B2 Pro (and compatible NIIMBOT thermal printers)
// Allows 1-click printing directly from the browser without downloading files or opening the NIIMBOT app.

import { Product } from '@/types';
import { BarcodeLabelConfig, encodeCode128B } from './barcodeGenerator';

// BLE UUIDs extracted from NIIMBOT macOS SDK (libjcPrinterSdk.dylib)
const NIIMBOT_BLE_SERVICES = [
    'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
    '0000e0ff-3c17-d293-8e48-14fe2e4da212',
    '49535343-fe7d-4ae5-8fa9-9fafd205e455',
    '0000ff00-0000-1000-8000-00805f9b34fb',
    '0000ffe0-0000-1000-8000-00805f9b34fb',
];

const NIIMBOT_WRITE_CHARACTERISTICS = [
    'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f',
    '0000ffe1-0000-1000-8000-00805f9b34fb',
    '0000ffe2-0000-1000-8000-00805f9b34fb',
    '49535343-8841-43f4-a8d4-ecbe34729bb3',
    '0000ff02-0000-1000-8000-00805f9b34fb',
];

export type NiimbotTransportType = 'bluetooth' | 'serial';

export interface NiimbotConnectionInfo {
    connected: boolean;
    deviceName: string;
    transport: NiimbotTransportType | null;
    dpi: 203 | 300;
}

export interface NiimbotPrintQueueItem {
    product: Product;
    copies: number;
}

interface ActiveBleConnection {
    device: any;
    server: any;
    writeChar: any;
    notifyChar?: any;
}

interface ActiveSerialConnection {
    port: any;
    writer: any;
}

let activeBle: ActiveBleConnection | null = null;
let activeSerial: ActiveSerialConnection | null = null;
let currentDeviceName = '';
let currentTransport: NiimbotTransportType | null = null;
let currentDpi: 203 | 300 = 300; // NIIMBOT B2 Pro is native 300 DPI (paccuracyName: "300" in devices.json)

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Build a framed NIIMBOT command packet:
 * [0x55, 0x55, cmd, len, ...data, checksum, 0xAA, 0xAA]
 */
export function buildNiimbotPacket(cmd: number, data: number[] | Uint8Array): Uint8Array {
    const len = data.length;
    const packet = new Uint8Array(len + 7);
    packet[0] = 0x55;
    packet[1] = 0x55;
    packet[2] = cmd & 0xff;
    packet[3] = len & 0xff;

    let checksum = packet[2] ^ packet[3];
    for (let i = 0; i < len; i++) {
        const b = data[i] & 0xff;
        packet[4 + i] = b;
        checksum ^= b;
    }

    packet[4 + len] = checksum & 0xff;
    packet[5 + len] = 0xaa;
    packet[6 + len] = 0xaa;
    return packet;
}

function popcount8(byte: number): number {
    let b = byte & 0xff;
    b = b - ((b >> 1) & 0x55);
    b = (b & 0x33) + ((b >> 2) & 0x33);
    return (((b + (b >> 4)) & 0x0f) * 0x01) & 0xff;
}

/**
 * Check if browser supports Web Bluetooth or Web Serial
 */
export function getDirectPrintCapabilities(): {
    bluetoothSupported: boolean;
    serialSupported: boolean;
} {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
        return { bluetoothSupported: false, serialSupported: false };
    }
    return {
        bluetoothSupported: 'bluetooth' in navigator,
        serialSupported: 'serial' in navigator,
    };
}

/**
 * Get current NIIMBOT connection status
 */
export function getNiimbotConnectionInfo(): NiimbotConnectionInfo {
    const isBleAlive = Boolean(activeBle?.device?.gatt?.connected && activeBle?.writeChar);
    const isSerialAlive = Boolean(activeSerial?.port && activeSerial?.writer);

    if (!isBleAlive && currentTransport === 'bluetooth') {
        activeBle = null;
        currentTransport = null;
    }
    if (!isSerialAlive && currentTransport === 'serial') {
        activeSerial = null;
        currentTransport = null;
    }

    return {
        connected: isBleAlive || isSerialAlive,
        deviceName: isBleAlive || isSerialAlive ? currentDeviceName : '',
        transport: currentTransport,
        dpi: currentDpi,
    };
}

export function setNiimbotDpi(dpi: 203 | 300) {
    currentDpi = dpi;
}

/**
 * Connect to NIIMBOT B2 Pro via Web Bluetooth (BLE)
 */
export async function connectNiimbotBluetooth(): Promise<NiimbotConnectionInfo> {
    const nav = navigator as any;
    if (!nav.bluetooth) {
        throw new Error(
            'เบราว์เซอร์นี้ไม่รองรับ Web Bluetooth กรุณาเปิดผ่าน Google Chrome หรือ Microsoft Edge บนคอมพิวเตอร์'
        );
    }

    const device = await nav.bluetooth.requestDevice({
        filters: [
            { namePrefix: 'B2' },
            { namePrefix: 'NIIMBOT' },
            { namePrefix: 'B21' },
            { namePrefix: 'B1' },
            { namePrefix: 'B3' },
            { namePrefix: 'D1' },
        ],
        optionalServices: NIIMBOT_BLE_SERVICES,
    });

    if (!device.gatt) {
        throw new Error('ไม่พบ GATT Server บนเครื่องปริ้น Bluetooth นี้');
    }

    device.addEventListener('gattserverdisconnected', () => {
        activeBle = null;
        if (currentTransport === 'bluetooth') {
            currentTransport = null;
        }
    });

    const server = await device.gatt.connect();
    const services = await server.getPrimaryServices();

    let foundWriteChar: any = null;
    let foundNotifyChar: any = null;

    // 1. Try known NIIMBOT write characteristics first
    for (const service of services) {
        try {
            const chars = await service.getCharacteristics();
            for (const c of chars) {
                const uuid = String(c.uuid).toLowerCase();
                const props = c.properties;
                if (
                    NIIMBOT_WRITE_CHARACTERISTICS.includes(uuid) &&
                    (props.write || props.writeWithoutResponse)
                ) {
                    foundWriteChar = c;
                }
                if (props.notify && !foundNotifyChar) {
                    foundNotifyChar = c;
                }
            }
        } catch {
            // Continue scanning services
        }
    }

    // 2. Fallback: pick any writable characteristic in the discovered services
    if (!foundWriteChar) {
        for (const service of services) {
            try {
                const chars = await service.getCharacteristics();
                for (const c of chars) {
                    if (c.properties.write || c.properties.writeWithoutResponse) {
                        foundWriteChar = c;
                        break;
                    }
                }
                if (foundWriteChar) break;
            } catch {
                // ignore
            }
        }
    }

    if (!foundWriteChar) {
        throw new Error(
            'เชื่อมต่อ Bluetooth สำเร็จแต่ไม่พบช่องส่งข้อมูลพิมพ์ (หากเปิดแอป NIIMBOT บนคอมอยู่ กรุณากดตัดการเชื่อมต่อหรือปิดแอป NIIMBOT ก่อน เพื่อให้หน้าเว็บเชื่อมต่อตรงได้)'
        );
    }

    if (foundNotifyChar) {
        try {
            await foundNotifyChar.startNotifications();
        } catch {
            // Notifications are optional
        }
    }

    activeBle = {
        device,
        server,
        writeChar: foundWriteChar,
        notifyChar: foundNotifyChar,
    };
    currentDeviceName = device.name || 'NIIMBOT B2 Pro (Bluetooth)';
    currentTransport = 'bluetooth';

    // B2 Pro is native 300 DPI; standard B2 (without Pro) is 203 DPI
    if (
        currentDeviceName.toLowerCase().includes('b2-') &&
        !currentDeviceName.toLowerCase().includes('pro')
    ) {
        currentDpi = 203;
    } else {
        currentDpi = 300;
    }

    // Send Connect handshake packet (0xC1, [0x01])
    await sendRawPacket(buildNiimbotPacket(0xc1, [0x01]));
    await sleep(80);

    return getNiimbotConnectionInfo();
}

/**
 * Connect to NIIMBOT B2 Pro via USB Cable / Virtual Serial Port (Web Serial)
 */
export async function connectNiimbotSerial(): Promise<NiimbotConnectionInfo> {
    const nav = navigator as any;
    if (!nav.serial) {
        throw new Error(
            'เบราว์เซอร์นี้ไม่รองรับการเชื่อมต่อสาย USB (Web Serial) กรุณาใช้ Google Chrome บนคอมพิวเตอร์'
        );
    }

    const port = await nav.serial.requestPort();
    await port.open({ baudRate: 115200 });

    const writer = port.writable.getWriter();

    activeSerial = { port, writer };
    currentDeviceName = 'NIIMBOT B2 Pro (USB)';
    currentTransport = 'serial';
    currentDpi = 300;

    // Send Connect handshake packet (0xC1, [0x01])
    await sendRawPacket(buildNiimbotPacket(0xc1, [0x01]));
    await sleep(60);

    return getNiimbotConnectionInfo();
}

/**
 * Disconnect active printer connection
 */
export async function disconnectNiimbot(): Promise<void> {
    try {
        if (activeBle?.device?.gatt?.connected) {
            activeBle.device.gatt.disconnect();
        }
    } catch {
        // ignore
    }
    try {
        if (activeSerial?.writer) {
            activeSerial.writer.releaseLock();
        }
        if (activeSerial?.port) {
            await activeSerial.port.close();
        }
    } catch {
        // ignore
    }
    activeBle = null;
    activeSerial = null;
    currentTransport = null;
    currentDeviceName = '';
}

async function sendRawPacket(packet: Uint8Array): Promise<void> {
    if (currentTransport === 'serial' && activeSerial?.writer) {
        await activeSerial.writer.write(packet);
        return;
    }

    if (currentTransport === 'bluetooth' && activeBle?.writeChar) {
        const char = activeBle.writeChar;
        const maxChunk = 128;
        for (let offset = 0; offset < packet.length; offset += maxChunk) {
            const slice = packet.subarray(offset, Math.min(offset + maxChunk, packet.length));
            if (char.properties.writeWithoutResponse && char.writeValueWithoutResponse) {
                await char.writeValueWithoutResponse(slice);
            } else {
                await char.writeValue(slice);
            }
            if (packet.length > maxChunk) {
                await sleep(6);
            }
        }
        return;
    }

    throw new Error('ยังไม่ได้เชื่อมต่อเครื่องปริ้น NIIMBOT B2 Pro');
}

/**
 * Render a product barcode label directly at the exact dot-matrix resolution of NIIMBOT B2 Pro
 * and pack into 1-bit monochrome rows.
 */
function encodeProductLabelToNiimbotRows(
    product: Product,
    config: BarcodeLabelConfig,
    dpi: 203 | 300
): {
    widthDots: number;
    heightDots: number;
    bytesPerRow: number;
    rows: Uint8Array[];
} {
    const dotsPerMm = dpi === 300 ? 300 / 25.4 : 8; // 11.8110236 dots/mm for 300 DPI
    const dotsPerCm = dotsPerMm * 10;
    const maxPrintheadMm = 48; // B2 Pro widthSetEnd = 48mm

    const wCm = Math.min(5.0, Math.max(1.5, Number(config.widthCm) || 5.0));
    const hCm = Math.min(15.0, Math.max(1.0, Number(config.heightCm) || 3.0));

    const labelWidthMm = Math.min(maxPrintheadMm, wCm * 10);
    const labelHeightMm = hCm * 10;

    const rawLabelDotsW = Math.round(labelWidthMm * dotsPerMm);
    const widthDots = Math.ceil(rawLabelDotsW / 8) * 8;
    const heightDots = Math.round(labelHeightMm * dotsPerMm);
    const bytesPerRow = widthDots / 8;

    const canvas = document.createElement('canvas');
    canvas.width = widthDots;
    canvas.height = heightDots;
    const ctx = canvas.getContext('2d')!;

    // Pure white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, widthDots, heightDots);

    // Offset calibration in dots
    const offsetXDots = Math.round((Number(config.offsetXMm) || 0) * dotsPerMm);
    const offsetYDots = Math.round((Number(config.offsetYMm) || 0) * dotsPerMm);
    ctx.save();
    ctx.translate(offsetXDots, offsetYDots);

    const scaleFactor = config.fontScale === 'sm' ? 0.85 : config.fontScale === 'lg' ? 1.15 : 1.0;
    const minDim = Math.min(wCm, hCm);
    const isTiny = hCm <= 1.8 || wCm <= 2.8;

    const ptToPx = (pt: number) => Math.max(10, Math.round(pt * 0.0352778 * dotsPerCm));

    const storeFontPx = ptToPx(Math.max(5, minDim * 2.5 * scaleFactor));
    const skuFontPx = ptToPx(Math.max(6.5, minDim * 3.3 * scaleFactor));
    const nameFontPx = ptToPx(Math.max(5.5, minDim * 2.7 * scaleFactor));
    const metaFontPx = ptToPx(Math.max(5, minDim * 2.4 * scaleFactor));
    const priceFontPx = ptToPx(Math.max(6.5, minDim * 3.4 * scaleFactor));

    const activeInfoLines =
        (config.showStoreName ? 1 : 0) +
        (config.showSkuText ? 1 : 0) +
        (config.showStoneName ? 1 : 0) +
        (config.showWeightAndDim || config.showPrice ? 1 : 0);

    const ratio = activeInfoLines <= 1 ? 0.58 : activeInfoLines === 2 ? 0.46 : isTiny ? 0.36 : 0.4;
    const barcodeHeightDots = Math.max(24, Math.round(hCm * ratio * dotsPerCm));
    const padDots = Math.round((isTiny ? 0.1 : 0.15) * dotsPerCm);

    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    let currentY = padDots;
    const innerW = widthDots - padDots * 2;

    // 1. Store Name
    if (config.showStoreName) {
        ctx.font = `900 ${storeFontPx}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
        ctx.fillText('VIVIDA CRYSTAL', widthDots / 2, currentY, innerW);
        currentY += Math.round(storeFontPx * 1.18);
    }

    // 2. Crisp Code 128 Barcode Bars
    const encoded = encodeCode128B(product.sku);
    const barcodeW = Math.round(innerW * 0.96);
    const moduleW = barcodeW / encoded.totalModules;
    const barcodeStartX = Math.round((widthDots - barcodeW) / 2);

    ctx.fillStyle = '#000000';
    encoded.bars.forEach((bar) => {
        const x1 = Math.round(barcodeStartX + bar.x * moduleW);
        const x2 = Math.round(barcodeStartX + (bar.x + bar.width) * moduleW);
        ctx.fillRect(x1, currentY, Math.max(1, x2 - x1), barcodeHeightDots);
    });
    currentY += barcodeHeightDots + Math.max(2, Math.round(0.04 * dotsPerCm));

    // 3. SKU Line
    if (config.showSkuText) {
        ctx.font = `900 ${skuFontPx}px ui-monospace, SFMono-Regular, Menlo, monospace`;
        ctx.fillText(product.sku, widthDots / 2, currentY, innerW);
        currentY += Math.round(skuFontPx * 1.16);
    }

    // 4. Stone Name
    if (config.showStoneName) {
        ctx.font = `800 ${nameFontPx}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
        ctx.fillText(product.stone_type || product.name, widthDots / 2, currentY, innerW);
        currentY += Math.round(nameFontPx * 1.18);
    }

    // 5. Weight / Dimensions & Selling Price
    const weightText = product.weight_grams ? `${product.weight_grams}g` : '';
    const dimText = product.dimensions || '';
    const specsLine = [weightText, dimText].filter(Boolean).join(' • ');
    const priceText =
        product.selling_price && product.selling_price > 0
            ? `฿${product.selling_price.toLocaleString()}`
            : '';

    if ((config.showWeightAndDim && specsLine) || (config.showPrice && priceText)) {
        const bottomY = heightDots - padDots - Math.max(priceFontPx, metaFontPx);

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(padDots, bottomY - Math.max(2, Math.round(0.03 * dotsPerCm)));
        ctx.lineTo(widthDots - padDots, bottomY - Math.max(2, Math.round(0.03 * dotsPerCm)));
        ctx.stroke();

        if (config.showWeightAndDim && config.showPrice && specsLine && priceText) {
            ctx.textAlign = 'left';
            ctx.font = `700 ${metaFontPx}px -apple-system, BlinkMacSystemFont, sans-serif`;
            ctx.fillText(specsLine, padDots, bottomY, innerW * 0.62);

            ctx.textAlign = 'right';
            ctx.font = `900 ${priceFontPx}px -apple-system, BlinkMacSystemFont, sans-serif`;
            ctx.fillText(
                priceText,
                widthDots - padDots,
                bottomY - Math.round((priceFontPx - metaFontPx) * 0.25)
            );
        } else {
            ctx.textAlign = 'center';
            const textToDraw = config.showPrice && priceText ? priceText : specsLine;
            const fPx = config.showPrice && priceText ? priceFontPx : metaFontPx;
            ctx.font = `900 ${fPx}px -apple-system, BlinkMacSystemFont, sans-serif`;
            ctx.fillText(textToDraw, widthDots / 2, bottomY, innerW);
        }
    }

    ctx.restore();

    // Extract 1-bit packed monochrome rows
    const imgData = ctx.getImageData(0, 0, widthDots, heightDots).data;
    const rows: Uint8Array[] = [];

    for (let y = 0; y < heightDots; y++) {
        const rowBytes = new Uint8Array(bytesPerRow);
        for (let x = 0; x < widthDots; x++) {
            const idx = (y * widthDots + x) * 4;
            const r = imgData[idx];
            const g = imgData[idx + 1];
            const b = imgData[idx + 2];
            const a = imgData[idx + 3];

            const lum = a < 128 ? 255 : 0.299 * r + 0.587 * g + 0.114 * b;
            if (lum < 175) {
                const byteIdx = x >> 3;
                const bitPos = 7 - (x & 7);
                rowBytes[byteIdx] |= 1 << bitPos;
            }
        }
        rows.push(rowBytes);
    }

    return { widthDots, heightDots, bytesPerRow, rows };
}

/**
 * Stream a single encoded page to the NIIMBOT B2 Pro printer
 */
async function sendNiimbotPage(
    encoded: {
        widthDots: number;
        heightDots: number;
        bytesPerRow: number;
        rows: Uint8Array[];
    },
    quantity: number
): Promise<void> {
    const { widthDots, heightDots, bytesPerRow, rows } = encoded;

    // 1. PageStart (0x03, [0x01])
    await sendRawPacket(buildNiimbotPacket(0x03, [0x01]));
    await sleep(35);

    // 2. SetPageSize / jcSetPageInfo (0x13, [height_hi, height_lo, width_hi, width_lo, count_hi, count_lo])
    const copies = Math.max(1, quantity);
    await sendRawPacket(
        buildNiimbotPacket(0x13, [
            (heightDots >> 8) & 0xff,
            heightDots & 0xff,
            (widthDots >> 8) & 0xff,
            widthDots & 0xff,
            (copies >> 8) & 0xff,
            copies & 0xff,
        ])
    );
    await sleep(45);

    // 3. Stream bitmap rows using 0x84 (blank rows) and 0x85 (1-color bitmap row from cPrinterV5::sendPrintData)
    const segBytes = Math.floor(bytesPerRow / 3);
    let y = 0;

    while (y < heightDots) {
        const row = rows[y];
        let totalBits = 0;
        for (let i = 0; i < bytesPerRow; i++) {
            totalBits += popcount8(row[i]);
        }

        if (totalBits === 0) {
            let blankCount = 1;
            while (y + blankCount < heightDots && blankCount < 250) {
                const nextRow = rows[y + blankCount];
                let nextHasBits = false;
                for (let i = 0; i < bytesPerRow; i++) {
                    if (nextRow[i] !== 0) {
                        nextHasBits = true;
                        break;
                    }
                }
                if (nextHasBits) break;
                blankCount++;
            }

            await sendRawPacket(
                buildNiimbotPacket(0x84, [
                    (y >> 8) & 0xff,
                    y & 0xff,
                    blankCount & 0xff,
                ])
            );
            y += blankCount;
            await sleep(4);
            continue;
        }

        // Compress identical consecutive rows (vertical barcode bars!)
        let repeatCount = 1;
        while (y + repeatCount < heightDots && repeatCount < 25) {
            const nextRow = rows[y + repeatCount];
            let identical = true;
            for (let i = 0; i < bytesPerRow; i++) {
                if (nextRow[i] !== row[i]) {
                    identical = false;
                    break;
                }
            }
            if (!identical) break;
            repeatCount++;
        }

        let count1 = 0;
        let count2 = 0;
        let count3 = 0;
        for (let i = 0; i < bytesPerRow; i++) {
            const bits = popcount8(row[i]);
            if (i < segBytes) count1 += bits;
            else if (i < segBytes * 2) count2 += bits;
            else count3 += bits;
        }

        const payload = new Uint8Array(6 + bytesPerRow);
        payload[0] = (y >> 8) & 0xff;
        payload[1] = y & 0xff;
        payload[2] = count1 & 0xff;
        payload[3] = count2 & 0xff;
        payload[4] = count3 & 0xff;
        payload[5] = repeatCount & 0xff;
        payload.set(row, 6);

        await sendRawPacket(buildNiimbotPacket(0x85, payload));
        y += repeatCount;

        await sleep(currentTransport === 'bluetooth' ? 7 : 3);
    }

    // 4. PageEnd / jcSetPageTerminal (0xE3, [0x01])
    await sleep(60);
    await sendRawPacket(buildNiimbotPacket(0xe3, [0x01]));
    await sleep(120 * copies);
}

/**
 * Print all selected barcode labels directly to NIIMBOT B2 Pro
 */
export async function printDirectToNiimbotB2Pro(
    items: NiimbotPrintQueueItem[],
    config: BarcodeLabelConfig,
    options?: {
        density?: number; // 1..5 (default 3)
        dpi?: 203 | 300;
        onProgress?: (current: number, total: number, statusText: string) => void;
    }
): Promise<void> {
    const validItems = items.filter((item) => item.copies > 0);
    if (validItems.length === 0) {
        throw new Error('กรุณาเลือกรายการที่ต้องการพิมพ์อย่างน้อย 1 ดวง');
    }

    const info = getNiimbotConnectionInfo();
    if (!info.connected) {
        await connectNiimbotBluetooth();
    }

    const density = Math.min(5, Math.max(1, options?.density ?? 3));
    const dpi = options?.dpi ?? currentDpi;
    const totalPages = validItems.reduce((sum, item) => sum + item.copies, 0);

    options?.onProgress?.(0, totalPages, 'กำลังเตรียมหัวพิมพ์ NIIMBOT B2 Pro...');

    // 1. Set Print Density (0x21) & Label Type (0x23 = 1 Gap Paper)
    await sendRawPacket(buildNiimbotPacket(0x21, [density]));
    await sleep(40);
    await sendRawPacket(buildNiimbotPacket(0x23, [0x01]));
    await sleep(40);

    // 2. StartJob / jcSetPrintAllTime (0x01)
    await sendRawPacket(
        buildNiimbotPacket(0x01, [
            (totalPages >> 8) & 0xff,
            totalPages & 0xff,
            0x00,
            0x00,
            0x00,
            0x00,
            0x01,
        ])
    );
    await sleep(80);

    let printedSoFar = 0;

    for (let i = 0; i < validItems.length; i++) {
        const item = validItems[i];
        options?.onProgress?.(
            printedSoFar + 1,
            totalPages,
            `กำลังส่งพิมพ์ ${item.product.sku} (${item.copies} ดวง)...`
        );

        const encoded = encodeProductLabelToNiimbotRows(item.product, config, dpi);
        await sendNiimbotPage(encoded, item.copies);
        printedSoFar += item.copies;

        options?.onProgress?.(
            printedSoFar,
            totalPages,
            `พิมพ์แล้ว ${printedSoFar}/${totalPages} ดวง`
        );
        await sleep(100);
    }

    // 3. PrintEnd / jcSetPrintTerminal (0xF3, [0x01])
    await sleep(120);
    await sendRawPacket(buildNiimbotPacket(0xf3, [0x01]));
}
