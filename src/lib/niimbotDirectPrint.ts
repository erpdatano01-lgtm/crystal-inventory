// Direct Web Bluetooth & Web Serial printing for NIIMBOT B2 Pro (and compatible NIIMBOT thermal printers)
// Allows 1-click printing directly from the browser without downloading files or opening the NIIMBOT app.
// Protocol reverse-engineered directly from NIIMBOT macOS SDK (libjcPrinterSdk.dylib: JCBleControl, cPrinterV5, cPrinterV6, packageOneColorData).

import { Product } from '@/types';
import { BarcodeLabelConfig, encodeCode128B } from './barcodeGenerator';

// BLE Service UUIDs in exact priority order from JCBleControl (libjcPrinterSdk.dylib)
const NIIMBOT_BLE_SERVICES = [
    'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
    '0000e0ff-3c17-d293-8e48-14fe2e4da212',
    '49535343-fe7d-4ae5-8fa9-9fafd205e455',
    '0000ff00-0000-1000-8000-00805f9b34fb',
    '0000ffe0-0000-1000-8000-00805f9b34fb',
    '0000ae30-0000-1000-8000-00805f9b34fb',
];

// Combined Write+Notify Characteristic UUIDs prioritized by JCBleControl
const NIIMBOT_COMBINED_CHAR_UUIDS = [
    'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f',
    '0000ffe1-0000-1000-8000-00805f9b34fb',
    '49535343-8841-43f4-a8d4-ecbe34729bb3',
];

const NIIMBOT_WRITE_CHARACTERISTICS = [
    'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f',
    '0000ffe1-0000-1000-8000-00805f9b34fb',
    '49535343-8841-43f4-a8d4-ecbe34729bb3',
    '0000ffe2-0000-1000-8000-00805f9b34fb',
    '0000ff02-0000-1000-8000-00805f9b34fb',
    '0000ae01-0000-1000-8000-00805f9b34fb',
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

interface ParsedNiimbotPacket {
    cmd: number;
    data: Uint8Array;
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
    reader?: any;
}

let activeBle: ActiveBleConnection | null = null;
let activeSerial: ActiveSerialConnection | null = null;
let currentDeviceName = '';
let currentTransport: NiimbotTransportType | null = null;
let currentDpi: 203 | 300 = 300; // NIIMBOT B2 Pro is native 300 DPI (paccuracyName: "300" in devices.json)

// Incoming packet buffer and resolvers for BLE / Serial notifications
let rxBuffer: number[] = [];
let packetListeners: Array<(pkt: ParsedNiimbotPacket) => void> = [];
let lastReceivedPackets = new Map<number, ParsedNiimbotPacket>();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Feed incoming raw bytes from BLE Notification or Web Serial into the NIIMBOT frame parser
 */
function handleIncomingBytes(bytes: Uint8Array) {
    for (let i = 0; i < bytes.length; i++) {
        rxBuffer.push(bytes[i] & 0xff);
    }

    // Parse all complete [0x55, 0x55, cmd, len, ...data, chk, 0xAA, 0xAA] packets
    while (rxBuffer.length >= 7) {
        // Find 0x55 0x55 header
        let startIdx = -1;
        for (let i = 0; i <= rxBuffer.length - 2; i++) {
            if (rxBuffer[i] === 0x55 && rxBuffer[i + 1] === 0x55) {
                startIdx = i;
                break;
            }
        }

        if (startIdx === -1) {
            rxBuffer = rxBuffer.slice(-1);
            break;
        }
        if (startIdx > 0) {
            rxBuffer.splice(0, startIdx);
        }
        if (rxBuffer.length < 7) break;

        const cmd = rxBuffer[2];
        const len = rxBuffer[3];
        const totalLen = len + 7;

        if (rxBuffer.length < totalLen) {
            break; // Wait for more bytes
        }

        if (rxBuffer[totalLen - 2] === 0xaa && rxBuffer[totalLen - 1] === 0xaa) {
            const data = new Uint8Array(rxBuffer.slice(4, 4 + len));
            rxBuffer.splice(0, totalLen);

            const pkt: ParsedNiimbotPacket = { cmd, data };
            lastReceivedPackets.set(cmd, pkt);
            const listeners = [...packetListeners];
            for (const fn of listeners) {
                try {
                    fn(pkt);
                } catch {
                    // ignore listener error
                }
            }
        } else {
            // Invalid tail, advance past first 0x55
            rxBuffer.splice(0, 1);
        }
    }

    if (rxBuffer.length > 2048) {
        rxBuffer = rxBuffer.slice(-256);
    }
}

function waitForPacket(expectedCmd: number | number[], timeoutMs: number): Promise<ParsedNiimbotPacket | null> {
    const cmdSet = new Set(Array.isArray(expectedCmd) ? expectedCmd : [expectedCmd]);
    return new Promise((resolve) => {
        let settled = false;
        const onPacket = (pkt: ParsedNiimbotPacket) => {
            if (cmdSet.has(pkt.cmd) && !settled) {
                settled = true;
                packetListeners = packetListeners.filter((l) => l !== onPacket);
                clearTimeout(timer);
                resolve(pkt);
            }
        };
        const timer = setTimeout(() => {
            if (!settled) {
                settled = true;
                packetListeners = packetListeners.filter((l) => l !== onPacket);
                resolve(null);
            }
        }, timeoutMs);

        packetListeners.push(onPacket);
    });
}

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
 * Uses exact service & characteristic discovery logic from JCBleControl in libjcPrinterSdk.dylib
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
    const discoveredServices = await server.getPrimaryServices();

    // Sort discovered services according to JCBleControl priority order
    const sortedServices = [...discoveredServices].sort((a, b) => {
        const idxA = NIIMBOT_BLE_SERVICES.indexOf(String(a.uuid).toLowerCase());
        const idxB = NIIMBOT_BLE_SERVICES.indexOf(String(b.uuid).toLowerCase());
        const prioA = idxA === -1 ? 999 : idxA;
        const prioB = idxB === -1 ? 999 : idxB;
        return prioA - prioB;
    });

    let foundWriteChar: any = null;
    let foundNotifyChar: any = null;
    const allNotifyChars: any[] = [];

    // 1. Scan services in priority order following JCBleControl's didDiscoverCharacteristicsForService
    for (const service of sortedServices) {
        try {
            const chars = await service.getCharacteristics();
            let serviceWrite: any = null;
            let serviceNotify: any = null;

            // Check combined Write+Notify UUIDs first (bef8d6c9..., ffe1, 49535343-8841...)
            for (const c of chars) {
                const uuid = String(c.uuid).toLowerCase();
                const props = c.properties;
                if (props.notify || props.indicate) {
                    allNotifyChars.push(c);
                }
                if (NIIMBOT_COMBINED_CHAR_UUIDS.some((u) => uuid === u || uuid.includes(u.slice(4, 8)))) {
                    if (props.write || props.writeWithoutResponse) {
                        serviceWrite = c;
                    }
                    if (props.notify || props.indicate) {
                        serviceNotify = c;
                    }
                }
            }

            // Otherwise inspect all characteristics in this service for notify & write
            for (const c of chars) {
                const uuid = String(c.uuid).toLowerCase();
                const props = c.properties;
                if (!serviceNotify && (props.notify || props.indicate)) {
                    serviceNotify = c;
                }
                if (!serviceWrite && (props.writeWithoutResponse || props.write)) {
                    if (NIIMBOT_WRITE_CHARACTERISTICS.includes(uuid) || !foundWriteChar) {
                        serviceWrite = c;
                    }
                }
            }

            if (serviceWrite && !foundWriteChar) {
                foundWriteChar = serviceWrite;
                if (serviceNotify) {
                    foundNotifyChar = serviceNotify;
                }
            }
            if (serviceNotify && !foundNotifyChar) {
                foundNotifyChar = serviceNotify;
            }
        } catch {
            // Continue scanning remaining services
        }
    }

    if (!foundWriteChar) {
        throw new Error(
            'เชื่อมต่อ Bluetooth สำเร็จแต่ไม่พบช่องส่งข้อมูลพิมพ์ (หากเปิดแอป NIIMBOT บนคอมอยู่ กรุณากดตัดการเชื่อมต่อหรือปิดแอป NIIMBOT ก่อน เพื่อให้หน้าเว็บเชื่อมต่อตรงได้)'
        );
    }

    rxBuffer = [];
    lastReceivedPackets.clear();

    // Subscribe to BLE notifications on all notify characteristics so we never miss printer ACKs
    const notifyTargets = Array.from(new Set([foundNotifyChar, ...allNotifyChars].filter(Boolean)));
    for (const nChar of notifyTargets) {
        try {
            nChar.addEventListener('characteristicvaluechanged', (event: any) => {
                const val = event?.target?.value;
                if (val && val.buffer) {
                    handleIncomingBytes(new Uint8Array(val.buffer, val.byteOffset, val.byteLength));
                }
            });
            await nChar.startNotifications();
        } catch {
            // Ignore if a secondary notify characteristic fails
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

    // Handshake sequence from cPrinterControl::connectBluetoothPrinter:
    // 1. openConnect (0xC1 [0x01]) -> expects 0xC2 (printer beeps!)
    await sendCommandWaitAck(0xc1, [0x01], 0xc2, 450);
    // 2. Request printer info / protocol support (0x40 [0x01])
    await sendCommandWaitAck(0x40, [0x01], 0x41, 250);

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
    rxBuffer = [];
    lastReceivedPackets.clear();

    // Start background reader for serial ACKs
    let reader: any = null;
    if (port.readable) {
        try {
            reader = port.readable.getReader();
            (async () => {
                try {
                    while (true) {
                        const { value, done } = await reader.read();
                        if (done) break;
                        if (value) {
                            handleIncomingBytes(value);
                        }
                    }
                } catch {
                    // Serial port closed
                }
            })();
        } catch {
            // ignore reader error
        }
    }

    activeSerial = { port, writer, reader };
    currentDeviceName = 'NIIMBOT B2 Pro (USB)';
    currentTransport = 'serial';
    currentDpi = 300;

    // Send Connect handshake packet (0xC1, [0x01])
    await sendCommandWaitAck(0xc1, [0x01], 0xc2, 350);

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
        if (activeSerial?.reader) {
            await activeSerial.reader.cancel();
            activeSerial.reader.releaseLock();
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
        // JCBleControl sends packets up to MTU (typically 180 bytes on macOS BLE)
        const maxChunk = 150;
        for (let offset = 0; offset < packet.length; offset += maxChunk) {
            const slice = packet.subarray(offset, Math.min(offset + maxChunk, packet.length));
            if (char.properties.writeWithoutResponse && char.writeValueWithoutResponse) {
                await char.writeValueWithoutResponse(slice);
            } else {
                await char.writeValue(slice);
            }
            if (packet.length > maxChunk) {
                await sleep(5);
            }
        }
        return;
    }

    throw new Error('ยังไม่ได้เชื่อมต่อเครื่องปริ้น NIIMBOT B2 Pro');
}

/**
 * Send a command packet and wait for expected ACK command from printer (or timeout gracefully)
 */
async function sendCommandWaitAck(
    cmd: number,
    data: number[] | Uint8Array,
    expectedAckCmd: number | number[],
    timeoutMs = 350
): Promise<ParsedNiimbotPacket | null> {
    const waitPromise = waitForPacket(expectedAckCmd, timeoutMs);
    await sendRawPacket(buildNiimbotPacket(cmd, data));
    return waitPromise;
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

    // Exact typography and proportional metrics aligned with BarcodePrintModal 300 DPI layout
    const storeFontPt = Math.max(5, Math.round(minDim * 2.5 * scaleFactor * 10) / 10);
    const skuFontPt = Math.max(6.5, Math.round(minDim * 3.3 * scaleFactor * 10) / 10);
    const nameFontPt = Math.max(5.5, Math.round(minDim * 2.7 * scaleFactor * 10) / 10);
    const metaFontPt = Math.max(5, Math.round(minDim * 2.4 * scaleFactor * 10) / 10);
    const priceFontPt = Math.max(6.5, Math.round(minDim * 3.4 * scaleFactor * 10) / 10);

    const ptToPx = (pt: number) => Math.max(10, Math.round(pt * 0.0352778 * dotsPerCm));
    const storeFontPx = ptToPx(storeFontPt);
    const skuFontPx = ptToPx(skuFontPt);
    const nameFontPx = ptToPx(nameFontPt);
    const metaFontPx = ptToPx(metaFontPt);
    const priceFontPx = ptToPx(priceFontPt);

    const weightText = product.weight_grams ? `${product.weight_grams}g` : '';
    const dimText = product.dimensions || '';
    const specsLine = [weightText, dimText].filter(Boolean).join(' • ');
    const priceText =
        product.selling_price && product.selling_price > 0
            ? `฿${product.selling_price.toLocaleString()}`
            : '';
    const hasBottomLine = Boolean(
        (config.showWeightAndDim && specsLine) || (config.showPrice && priceText)
    );

    // Padding matches the exported image (8.5% bottom margin = ~2.5mm on a 30mm sticker)
    // In thermal gap printing, leaving this 2.5mm on canvas aligns the bottom line
    // perfectly with the physical bottom edge of the sticker without triggering the gap sensor cutoff!
    const sidePadDots = Math.round((isTiny ? 0.1 : 0.15) * dotsPerCm);
    const topPadDots = Math.round((isTiny ? 0.08 : 0.14) * dotsPerCm);
    const bottomMarginDots = Math.max(16, Math.round(Math.min(0.255, hCm * 0.085) * dotsPerCm));
    const printableBottomDots = heightDots - bottomMarginDots;

    const bottomRowFontH = Math.max(
        config.showPrice && priceText ? priceFontPx : 0,
        config.showWeightAndDim && specsLine ? metaFontPx : 0
    );
    const bottomY = printableBottomDots - bottomRowFontH;
    const dividerGap = Math.max(3, Math.round(0.03 * dotsPerCm));
    const dividerY = bottomY - dividerGap;

    const storeLineH = config.showStoreName ? Math.round(storeFontPx * 1.15) : 0;
    const skuLineH = config.showSkuText ? Math.round(skuFontPx * 1.15) : 0;
    const nameLineH = config.showStoneName ? Math.round(nameFontPx * 1.15) : 0;
    const barcodeGapDots = Math.max(3, Math.round(0.04 * dotsPerCm));

    const totalTextH = storeLineH + skuLineH + nameLineH;
    const maxAvailableBarcodeH = hasBottomLine
        ? dividerY - dividerGap - topPadDots - totalTextH - barcodeGapDots
        : printableBottomDots - topPadDots - totalTextH - barcodeGapDots;

    const targetBarcodeH = Math.round(hCm * (isTiny ? 0.35 : 0.38) * dotsPerCm);
    const barcodeHeightDots = Math.max(24, Math.min(targetBarcodeH, maxAvailableBarcodeH));

    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    let currentY = topPadDots;
    const innerW = widthDots - sidePadDots * 2;

    // 1. Store Name
    if (config.showStoreName) {
        ctx.font = `900 ${storeFontPx}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
        ctx.fillText('VIVIDA CRYSTAL', widthDots / 2, currentY, innerW);
        currentY += storeLineH;
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
    currentY += barcodeHeightDots + barcodeGapDots;

    // 3. SKU Line
    if (config.showSkuText) {
        ctx.font = `900 ${skuFontPx}px ui-monospace, SFMono-Regular, Menlo, monospace`;
        ctx.fillText(product.sku, widthDots / 2, currentY, innerW);
        currentY += skuLineH;
    }

    // 4. Stone Name
    if (config.showStoneName) {
        ctx.font = `800 ${nameFontPx}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
        ctx.fillText(product.stone_type || product.name, widthDots / 2, currentY, innerW);
        currentY += nameLineH;
    }

    // 5. Weight / Dimensions & Selling Price (positioned flush against bottom edge, exactly matching exported image)
    if (hasBottomLine) {
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sidePadDots, dividerY);
        ctx.lineTo(widthDots - sidePadDots, dividerY);
        ctx.stroke();

        if (config.showWeightAndDim && config.showPrice && specsLine && priceText) {
            ctx.textAlign = 'left';
            ctx.font = `700 ${metaFontPx}px -apple-system, BlinkMacSystemFont, sans-serif`;
            ctx.fillText(specsLine, sidePadDots, bottomY, innerW * 0.62);

            ctx.textAlign = 'right';
            ctx.font = `900 ${priceFontPx}px -apple-system, BlinkMacSystemFont, sans-serif`;
            ctx.fillText(
                priceText,
                widthDots - sidePadDots,
                bottomY - Math.round((priceFontPx - metaFontPx) * 0.25)
            );
        } else {
            ctx.textAlign = 'center';
            const textToDraw = config.showPrice && priceText ? priceText : specsLine;
            const fPx = config.showPrice && priceText ? priceFontPx : metaFontPx;
            ctx.font = `800 ${fPx}px -apple-system, BlinkMacSystemFont, sans-serif`;
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
 * Send StartPrint / jcSetPrintAllTime (0x01) with automatic protocol adaptation (V5 -> V6 -> V4 -> V3)
 * In libjcPrinterSdk.dylib:
 * - cPrinterV5::jcSetPrintAllTime sends 8 bytes: [pages_hi, pages_lo, 0, 0, 0, 0, pageColor(0), quality(0)]
 * - cPrinterV6::jcSetPrintAllTime sends 9 bytes: [pages_hi, pages_lo, 0, 0, 0, 0, pageColor(0), quality(0), flag(0)]
 * - cPrinterV4::jcSetPrintAllTime sends 7 bytes: [pages_hi, pages_lo, 0, 0, 0, 0, 0]
 * - cPrinterV3::jcSetPrintAllTime sends 1 byte:  [0x01]
 */
async function startNiimbotPrintJob(totalPages: number): Promise<void> {
    const hi = (totalPages >> 8) & 0xff;
    const lo = totalPages & 0xff;

    const candidatePayloads: number[][] = [
        // 1. cPrinterV5 (8 bytes) - primary protocol for NIIMBOT B2 Pro
        [hi, lo, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
        // 2. cPrinterV6 (9 bytes) - newer firmware variant
        [hi, lo, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
        // 3. cPrinterV4 (7 bytes)
        [hi, lo, 0x00, 0x00, 0x00, 0x00, 0x00],
        // 4. cPrinterV3 (1 byte)
        [0x01],
    ];

    for (const payload of candidatePayloads) {
        const ack = await sendCommandWaitAck(0x01, payload, 0x02, 350);
        if (ack && ack.data.length > 0 && ack.data[0] !== 0) {
            return; // Printer accepted StartPrint!
        }
    }

    // If notifications were not received (e.g. write-only characteristic), send V5 8-byte payload and wait briefly
    await sendRawPacket(buildNiimbotPacket(0x01, candidatePayloads[0]));
    await sleep(100);
}

/**
 * Stream a single encoded page to the NIIMBOT B2 Pro printer
 * Matches cPrinterV5::commitJob + packageOneColorData + cPrinterV5::sendPrintData
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
    const copies = Math.max(1, quantity);

    // 1. Strip trailing empty white rows at bottom of page (exact match to cPrinterV5::commitJob @ 0xff674)
    let effectiveHeight = heightDots;
    while (effectiveHeight > 0) {
        const r = rows[effectiveHeight - 1];
        let hasBlack = false;
        for (let i = 0; i < bytesPerRow; i++) {
            if (r[i] !== 0) {
                hasBlack = true;
                break;
            }
        }
        if (hasBlack) break;
        effectiveHeight--;
    }
    if (effectiveHeight === 0) {
        effectiveHeight = Math.min(30, heightDots);
    }

    // 2. PageStart / jcSetPagePrint (0x03, [0x01]) -> expects 0x04
    await sendCommandWaitAck(0x03, [0x01], 0x04, 300);

    // 3. SetPageSize / jcSetPageInfo (0x13, [rows_hi, rows_lo, cols_hi, cols_lo, copies_hi, copies_lo]) -> expects 0x14
    // In cPrinterV5::commitJob (@ 0xff798), rows passed to jcSetPageInfo is effectiveHeight ([x19, #0x60])
    const pageInfoAck = await sendCommandWaitAck(
        0x13,
        [
            (effectiveHeight >> 8) & 0xff,
            effectiveHeight & 0xff,
            (widthDots >> 8) & 0xff,
            widthDots & 0xff,
            (copies >> 8) & 0xff,
            copies & 0xff,
        ],
        0x14,
        350
    );

    // Fallback to 4-byte SetPageSize if printer NACKed 6-byte payload
    if (pageInfoAck && pageInfoAck.data.length > 0 && pageInfoAck.data[0] === 0) {
        await sendCommandWaitAck(
            0x13,
            [
                (effectiveHeight >> 8) & 0xff,
                effectiveHeight & 0xff,
                (widthDots >> 8) & 0xff,
                widthDots & 0xff,
            ],
            0x14,
            300
        );
    }

    // 4. Package bitmap rows into 200-row chunks (exact match to cPrinterV5::commitJob @ 0xff288..0xff440)
    // In packageOneColorData (@ 0x1bf0b8):
    // - cnt0 = black pixels in x = 0..191   (bytes 0..23)
    // - cnt1 = black pixels in x = 192..383 (bytes 24..47)
    // - cnt2 = black pixels in x >= 384     (bytes 48..)
    const CHUNK_ROW_LIMIT = 200;
    const chunks: Array<{
        startRow: number;
        lastRow: number;
        packets: Uint8Array[];
    }> = [];

    for (let chunkStart = 0; chunkStart < effectiveHeight; chunkStart += CHUNK_ROW_LIMIT) {
        const chunkEnd = Math.min(effectiveHeight, chunkStart + CHUNK_ROW_LIMIT);
        const packets: Uint8Array[] = [];
        let y = chunkStart;

        while (y < chunkEnd) {
            const row = rows[y];
            let totalBits = 0;
            for (let i = 0; i < bytesPerRow; i++) {
                totalBits += popcount8(row[i]);
            }

            if (totalBits === 0) {
                let blankCount = 1;
                while (y + blankCount < chunkEnd && blankCount < 200) {
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

                packets.push(
                    buildNiimbotPacket(0x84, [
                        (y >> 8) & 0xff,
                        y & 0xff,
                        blankCount & 0xff,
                    ])
                );
                y += blankCount;
            } else {
                let repeatCount = 1;
                while (y + repeatCount < chunkEnd && repeatCount < 200) {
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

                let cnt0 = 0;
                let cnt1 = 0;
                let cnt2 = 0;
                for (let i = 0; i < bytesPerRow; i++) {
                    const bits = popcount8(row[i]);
                    if (i < 24) cnt0 += bits;
                    else if (i < 48) cnt1 += bits;
                    else cnt2 += bits;
                }

                const payload = new Uint8Array(6 + bytesPerRow);
                payload[0] = (y >> 8) & 0xff;
                payload[1] = y & 0xff;
                payload[2] = cnt0 & 0xff;
                payload[3] = cnt1 & 0xff;
                payload[4] = cnt2 & 0xff;
                payload[5] = repeatCount & 0xff;
                payload.set(row, 6);

                packets.push(buildNiimbotPacket(0x85, payload));
                y += repeatCount;
            }
        }

        chunks.push({
            startRow: chunkStart,
            lastRow: chunkEnd - 1,
            packets,
        });
    }

    // 5. Send each 200-row chunk with 0xD3 verification and 0x86 (jcAskAfterPause) flush/retry
    // In cPrinterV5::commitJob (@ 0xfff84..0x1004ec):
    // - After sending a chunk, wait up to 256ms for 0xD3 notification
    // - If no 0xD3 notification (especially on the final <200-row chunk!), call jcAskAfterPause (0x86 [lastRow_hi, lastRow_lo, 0x01]) -> expects 0xD3
    // - If 0xD3 data[2] === 2, resend the chunk!
    for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
        const chunk = chunks[cIdx];
        let retries = 0;

        while (retries < 5) {
            lastReceivedPackets.delete(0xd3);
            const spontaneousD3 = waitForPacket(0xd3, 260);

            for (const pkt of chunk.packets) {
                await sendRawPacket(pkt);
                await sleep(currentTransport === 'bluetooth' ? 8 : 2);
            }

            let d3Resp = await spontaneousD3;
            if (!d3Resp) {
                // Active query: cPrinterV5::jcAskAfterPause (0x86, [lastRow_hi, lastRow_lo, 0x01])
                d3Resp = await sendCommandWaitAck(
                    0x86,
                    [
                        (chunk.lastRow >> 8) & 0xff,
                        chunk.lastRow & 0xff,
                        0x01,
                    ],
                    0xd3,
                    400
                );
            }

            // If printer responds with 0xD3 status === 2 ("开始的...行需要重发"), resend this chunk
            if (d3Resp && d3Resp.data.length >= 3 && d3Resp.data[2] === 0x02) {
                retries++;
                await sleep(50);
                continue;
            }

            break;
        }
    }

    // 6. PageEnd / jcSetPageTerminal (0xE3, [0x01]) -> expects 0xE4
    await sleep(80);
    await sendCommandWaitAck(0xe3, [0x01], 0xe4, 500);

    // 7. Wait for physical printhead to finish feeding/printing copies (poll 0xA3 -> 0xB3 as in cPrinterV5::commitJob @ 0x101004)
    const maxWaitIterations = Math.min(25, 6 * copies);
    for (let poll = 0; poll < maxWaitIterations; poll++) {
        await sleep(180);
        const statusPkt = await sendCommandWaitAck(0xa3, [0x01], 0xb3, 220);
        if (statusPkt && statusPkt.data.length >= 2) {
            const printedCopies = (statusPkt.data[0] << 8) | statusPkt.data[1];
            if (printedCopies >= copies) {
                break;
            }
        }
    }
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

    // 1. Set Print Density (0x21 -> 0x22) & Label Type (0x23 = 1 Gap Paper -> 0x24)
    await sendCommandWaitAck(0x21, [density], 0x22, 300);
    await sendCommandWaitAck(0x23, [0x01], 0x24, 300);

    // 2. StartJob / jcSetPrintAllTime (0x01 -> 0x02) with V5 8-byte payload (and automatic V6/V4/V3 fallback)
    await startNiimbotPrintJob(totalPages);

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
        await sleep(80);
    }

    // 3. PrintEnd / jcSetPrintTerminal (0xF3, [0x01] -> expects 0xF4)
    await sleep(100);
    await sendCommandWaitAck(0xf3, [0x01], 0xf4, 400);
}
