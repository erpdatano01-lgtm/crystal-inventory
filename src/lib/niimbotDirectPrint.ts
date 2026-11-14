// Direct Web Bluetooth & Web Serial printing for NIIMBOT B2 Pro (and compatible NIIMBOT thermal printers)
// Allows 1-click printing directly from the browser without downloading files or opening the NIIMBOT app.
// Protocol reverse-engineered directly from NIIMBOT macOS SDK (libjcPrinterSdk.dylib: JCBleControl, cPrinterV5, cPrinterV6, packageOneColorData).

import { Product } from '@/types';
import { BarcodeLabelConfig, buildPrintSheets, encodeCode128B } from './barcodeGenerator';

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
    modelId?: number;
    protocolVersion?: number;
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
let currentDpi: 203 | 300 = 300; // Default to 300 DPI as configured

// Detected hardware capabilities from printer handshake
let detectedProtocolVersion = 400; // Default to modern V4 (B21 Pro / B2 Pro)
let detectedModelId = 785; // Default B21 Pro
let detectedDpi: 203 | 300 = 300;
let detectedPrintheadDots = 576;

const MAX_TRACE_LOGS = 80;
function logTrace(msg: string) {
    if (typeof window !== 'undefined') {
        const win = window as any;
        if (!win.__niimbotLastTrace) {
            win.__niimbotLastTrace = [];
        }
        win.__niimbotLastTrace.push(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
        if (win.__niimbotLastTrace.length > MAX_TRACE_LOGS) {
            win.__niimbotLastTrace.shift();
        }
    }
}

function isV4Protocol(): boolean {
    const nameLower = (currentDeviceName || '').toLowerCase();
    return (
        detectedProtocolVersion >= 300 ||
        detectedModelId === 785 || // B21 Pro
        detectedModelId === 6912 || // B2 Pro
        detectedModelId === 4097 || // B1 Pro
        detectedModelId === 528 || // D11_H
        detectedModelId === 2560 || // M2_H
        nameLower.includes('pro') ||
        nameLower.includes('b21') ||
        nameLower.includes('b2') ||
        currentDpi === 300
    );
}

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
            if (cmd !== 0x86 && cmd !== 0xdc) {
                logTrace(`RX: cmd=0x${cmd.toString(16)} len=${len} data=[${Array.from(data.slice(0, 8)).map((b) => '0x' + b.toString(16)).join(',')}]`);
            }
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
        modelId: isBleAlive || isSerialAlive ? detectedModelId : undefined,
        protocolVersion: isBleAlive || isSerialAlive ? detectedProtocolVersion : undefined,
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
    currentDeviceName = device.name || 'NIIMBOT B21 (Bluetooth)';
    currentTransport = 'bluetooth';

    // Keep current DPI preference (defaults to 300 DPI as requested)
    const nameLower = currentDeviceName.toLowerCase();
    const isPro = nameLower.includes('pro');
    if (isPro) {
        currentDpi = 300;
    }

    await performNiimbotHandshake();

    return getNiimbotConnectionInfo();
}

/**
 * Handshake sequence from cPrinterControl::connectBluetoothPrinter & cPrinterV6:
 * Queries protocol version, model ID, and printhead geometry.
 */
async function performNiimbotHandshake(): Promise<void> {
    logTrace(`performNiimbotHandshake: start (${currentTransport}, name=${currentDeviceName})`);

    // 1. openConnect (0xC1 [0x01]) -> expects 0xC2 (printer beeps!)
    try {
        const connAck = await sendCommandWaitAck(0xc1, [0x01], 0xc2, 500);
        logTrace(`openConnect 0xC1 ACK: ${connAck ? '0x' + connAck.cmd.toString(16) : 'timeout'}`);
    } catch {
        // ignore
    }

    // 2. Protocol version query (0xA5 [0x01] -> 0xB5)
    // Byte 11 * 100 + Byte 12 gives protocol version (>= 300 = V4/V5)
    try {
        const protoPkt = await sendCommandWaitAck(0xa5, [0x01], 0xb5, 350);
        if (protoPkt && protoPkt.data.length >= 13) {
            const protoVer = protoPkt.data[11] * 100 + protoPkt.data[12];
            if (protoVer > 0) {
                detectedProtocolVersion = protoVer;
                logTrace(`detectedProtocolVersion: ${protoVer}`);
            }
        }
    } catch {
        // ignore
    }

    // 3. Model ID query (0x40 [0x08] -> 0x48)
    // 785 = B21 Pro, 6912 = B2 Pro, 4097 = B1 Pro, 4096 = B1, 768 = B21
    try {
        const modelPkt = await sendCommandWaitAck(0x40, [0x08], 0x48, 350);
        if (modelPkt && modelPkt.data.length >= 2) {
            const modelId = (modelPkt.data[0] << 8) | modelPkt.data[1];
            if (modelId > 0) {
                detectedModelId = modelId;
                logTrace(`detectedModelId: ${modelId}`);
            }
        }
    } catch {
        // ignore
    }

    // 4. Printhead info query (0xDC [0x03] -> 0xDE)
    // Bytes 4..5 = printhead dot width, Byte 6 = DPI flag (0x03 = 300 DPI, 0x02 = 203 DPI)
    try {
        const headPkt = await sendCommandWaitAck(0xdc, [0x03], 0xde, 350);
        if (headPkt && headPkt.data.length >= 7) {
            const widthDots = (headPkt.data[4] << 8) | headPkt.data[5];
            const dpiFlag = headPkt.data[6];
            if (widthDots > 0) detectedPrintheadDots = widthDots;
            if (dpiFlag === 0x03) {
                detectedDpi = 300;
                currentDpi = 300;
            } else if (dpiFlag === 0x02) {
                detectedDpi = 203;
            }
            logTrace(`printhead: width=${widthDots}, dpiFlag=${dpiFlag}`);
        }
    } catch {
        // ignore
    }
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
    currentDeviceName = 'NIIMBOT B21 (USB)';
    currentTransport = 'serial';

    await performNiimbotHandshake();

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
    const cmd = packet[2];
    if (cmd !== 0x85 && cmd !== 0x84) {
        logTrace(`TX: cmd=0x${cmd.toString(16)} len=${packet[3]}`);
    }

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
function drawNiimbotLabelRegion(
    ctx: CanvasRenderingContext2D,
    product: Product,
    config: BarcodeLabelConfig,
    wCm: number,
    hCm: number,
    widthDots: number,
    heightDots: number,
    dotsPerMm: number
): void {
    const dotsPerCm = dotsPerMm * 10;

    const scaleFactor = config.fontScale === 'sm' ? 0.85 : config.fontScale === 'lg' ? 1.15 : 1.0;
    const minDim = Math.min(wCm, hCm);
    const isTiny = hCm <= 1.8 || wCm <= 2.8;

    // Proportional metrics tuned to fill the entire sticker fully
    // without leaving an empty bottom void
    const storeFontPt = Math.max(4.8, Math.round(minDim * (isTiny ? 2.4 : 2.7) * scaleFactor * 10) / 10);
    const nameFontPt = Math.max(6.0, Math.round(minDim * (isTiny ? 3.4 : 3.6) * scaleFactor * 10) / 10);
    const skuFontPt = Math.max(5.6, Math.round(minDim * (isTiny ? 3.0 : 3.5) * scaleFactor * 10) / 10);
    const metaFontPt = Math.max(5.0, Math.round(minDim * (isTiny ? 2.5 : 2.6) * scaleFactor * 10) / 10);
    const priceFontPt = Math.max(5.8, Math.round(minDim * (isTiny ? 3.2 : 3.6) * scaleFactor * 10) / 10);

    const ptToPx = (pt: number) => Math.max(8, Math.round(pt * 0.0352778 * dotsPerCm));
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

    // Padding calibrated to fill the physical sticker edge-to-edge cleanly
    const sidePadDots = Math.round((isTiny ? 0.08 : 0.12) * dotsPerCm);
    const topPadDots = Math.round((isTiny ? 0.03 : 0.08) * dotsPerCm);
    const bottomMarginDots = Math.max(isTiny ? 4 : 8, Math.round((isTiny ? 0.03 : 0.05) * dotsPerCm));
    const printableBottomDots = heightDots - bottomMarginDots;

    const bottomRowFontH = Math.max(
        config.showPrice && priceText ? priceFontPx : 0,
        config.showWeightAndDim && specsLine ? metaFontPx : 0
    );
    const bottomY = printableBottomDots - bottomRowFontH;
    const dividerGap = Math.max(2, Math.round((isTiny ? 0.02 : 0.03) * dotsPerCm));
    const dividerY = bottomY - dividerGap;

    const storeLineH = config.showStoreName ? Math.round(storeFontPx * 1.15) : 0;
    const skuLineH = config.showSkuText ? Math.round(skuFontPx * 1.15) : 0;
    const nameLineH = config.showStoneName ? Math.round(nameFontPx * 1.15) : 0;
    const barcodeGapDots = Math.max(2, Math.round((isTiny ? 0.025 : 0.04) * dotsPerCm));

    const totalTextH = storeLineH + skuLineH + nameLineH;
    const maxAvailableBarcodeH = hasBottomLine
        ? dividerY - dividerGap - topPadDots - totalTextH - barcodeGapDots
        : printableBottomDots - topPadDots - totalTextH - barcodeGapDots;

    const targetBarcodeH = Math.round(hCm * (isTiny ? 0.42 : 0.45) * dotsPerCm);
    const barcodeHeightDots = Math.max(isTiny ? 25 : 30, Math.min(targetBarcodeH, Math.max(20, maxAvailableBarcodeH)));

    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    let currentY = topPadDots;
    const innerW = widthDots - sidePadDots * 2;

    // Optional: Store Name (only if explicitly checked by user, placed above stone name)
    if (config.showStoreName) {
        ctx.font = `900 ${storeFontPx}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
        ctx.fillText('VIVIDA CRYSTAL', widthDots / 2, currentY, innerW);
        currentY += storeLineH;
    }

    // 1. Stone Name (Primary header at the very top of label)
    if (config.showStoneName) {
        ctx.font = `800 ${nameFontPx}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
        ctx.fillText(product.stone_type || product.name, widthDots / 2, currentY, innerW);
        currentY += nameLineH;
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

    // 3. SKU Line (Directly below barcode bars)
    if (config.showSkuText) {
        ctx.font = `900 ${skuFontPx}px ui-monospace, SFMono-Regular, Menlo, monospace`;
        ctx.fillText(product.sku, widthDots / 2, currentY, innerW);
        currentY += skuLineH;
    }

    // 4. Weight / Dimensions & Selling Price with Divider Line
    // Anchor divider and bottom line at the bottom of the label to fill the entire sticker,
    // eliminating the old empty bottom void
    const sequentialDividerY = currentY + dividerGap;
    const actualDividerY = Math.max(sequentialDividerY, dividerY);
    const actualBottomY = actualDividerY === dividerY ? bottomY : actualDividerY + dividerGap + 1;

    if (hasBottomLine) {
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sidePadDots, actualDividerY);
        ctx.lineTo(widthDots - sidePadDots, actualDividerY);
        ctx.stroke();

        if (config.showWeightAndDim && config.showPrice && specsLine && priceText) {
            ctx.textAlign = 'left';
            ctx.font = `700 ${metaFontPx}px -apple-system, BlinkMacSystemFont, sans-serif`;
            ctx.fillText(specsLine, sidePadDots, actualBottomY, innerW * 0.62);

            ctx.textAlign = 'right';
            ctx.font = `900 ${priceFontPx}px -apple-system, BlinkMacSystemFont, sans-serif`;
            ctx.fillText(
                priceText,
                widthDots - sidePadDots,
                actualBottomY - Math.round((priceFontPx - metaFontPx) * 0.25)
            );
        } else {
            ctx.textAlign = 'center';
            const textToDraw = config.showPrice && priceText ? priceText : specsLine;
            const fPx = config.showPrice && priceText ? priceFontPx : metaFontPx;
            ctx.font = `800 ${fPx}px -apple-system, BlinkMacSystemFont, sans-serif`;
            ctx.fillText(textToDraw, widthDots / 2, actualBottomY, innerW);
        }
    }

}

/**
 * Render one physical sheet (widthCm × heightCm) to 1-bit rows.
 * `slots` = [product] for a normal label, or [top, bottom] for split-sheet mode (null = blank half).
 */
function encodeSheetToNiimbotRows(
    slots: (Product | null)[],
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

    // Offset calibration in dots (applied to the whole sheet)
    const offsetXDots = Math.round((Number(config.offsetXMm) || 0) * dotsPerMm);
    const offsetYDots = Math.round((Number(config.offsetYMm) || 0) * dotsPerMm);
    ctx.save();
    ctx.translate(offsetXDots, offsetYDots);

    const slotCount = Math.max(1, slots.length);
    const slotDots = Math.floor(heightDots / slotCount);
    const slotHCm = hCm / slotCount;

    slots.forEach((product, i) => {
        if (!product) return;
        ctx.save();

        if (slotCount === 2) {
            // Physical 40x30 mm split roll has:
            // - Top sticker: 0..14.5 mm
            // - Inter-label die cut gap: ~14.5..14.8 mm
            // - Bottom sticker: 14.8..29.4 mm
            // Now that the printer prints all 30 mm without premature cutoff,
            // make the layout fill the entire sticker edge-to-edge!
            const slotTopY = i === 0
                ? Math.round(0.02 * dotsPerCm) // 0.2 mm from top
                : Math.round((slotHCm - 0.02) * dotsPerCm); // 14.8 mm (clears middle die-cut gap)
            const slotHDots = Math.round((slotHCm - 0.04) * dotsPerCm); // 14.6 mm effective sticker height
            const slotHCmEffective = slotHDots / dotsPerCm;

            ctx.translate(0, slotTopY);
            ctx.beginPath();
            ctx.rect(0, 0, widthDots, slotHDots);
            ctx.clip();
            drawNiimbotLabelRegion(ctx, product, config, wCm, slotHCmEffective, widthDots, slotHDots, dotsPerMm);
        } else {
            ctx.translate(0, i * slotDots);
            ctx.beginPath();
            ctx.rect(0, 0, widthDots, slotDots);
            ctx.clip();
            drawNiimbotLabelRegion(ctx, product, config, wCm, slotHCm, widthDots, slotDots, dotsPerMm);
        }

        ctx.restore();
    });

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

    // cPrinterV6 / V4 / D110M_V4 (B21 Pro, B2 Pro, B1 Pro):
    // 9 bytes: [pages_hi, pages_lo, 0, 0, 0, 0, 0 (singleColor), speed=1, 0]
    // V5: 8 bytes: [pages_hi, pages_lo, 0, 0, 0, 0, 0, 0]
    // V4 legacy: 7 bytes: [pages_hi, pages_lo, 0, 0, 0, 0, 0]
    // V3: 1 byte: [0x01]
    const candidatePayloads: number[][] = isV4Protocol()
        ? [
              [hi, lo, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00],
              [hi, lo, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
              [hi, lo, 0x00, 0x00, 0x00, 0x00, 0x00],
              [0x01],
          ]
        : [
              [hi, lo, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
              [hi, lo, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00],
              [hi, lo, 0x00, 0x00, 0x00, 0x00, 0x00],
              [0x01],
          ];

    for (const payload of candidatePayloads) {
        const ack = await sendCommandWaitAck(0x01, payload, [0x02, 0xdb], 400);
        if (ack && ack.cmd === 0x02 && ack.data.length > 0 && ack.data[0] !== 0) {
            logTrace(`startNiimbotPrintJob accepted: len=${payload.length}`);
            return;
        }
    }

    // If notifications were not received (e.g. write-only characteristic), send first candidate payload and wait briefly
    logTrace(`startNiimbotPrintJob fallback send len=${candidatePayloads[0].length}`);
    await sendRawPacket(buildNiimbotPacket(0x01, candidatePayloads[0]));
    await sleep(80);
}

/**
 * Stream a single encoded page to the NIIMBOT B2 Pro printer
 * Matches cPrinterV6/V5 + packageOneColorData
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

    const reportedPageHeight = Math.max(heightDots, effectiveHeight);
    const useV4 = isV4Protocol();
    logTrace(`sendNiimbotPage: w=${widthDots}, h=${heightDots}, eff=${effectiveHeight}, v4=${useV4}, copies=${copies}`);

    if (useV4) {
        // B21 Pro Workaround:
        // 1. The B21 Pro drops the first BLE packet after PrintStart (0x01).
        // Send a one-way PrintStatus (0xA3 [0x01]) packet to safely absorb the hardware drop, then pause 35ms.
        // DO NOT send PageStart (0x03) as V4 / D110M_V4 firmware does not use 0x03.
        await sendRawPacket(buildNiimbotPacket(0xa3, [0x01]));
        await sleep(35);

        // 2. SetPageSize / jcSetPageInfo (0x13):
        // 13 bytes for V4 / D110M_V4 / B21 Pro:
        // [rows_hi, rows_lo, cols_hi, cols_lo, copies_hi, copies_lo, 0, 0, 0, 0, 0, 0, 0]
        const basePageInfo = [
            (reportedPageHeight >> 8) & 0xff,
            reportedPageHeight & 0xff,
            (widthDots >> 8) & 0xff,
            widthDots & 0xff,
            (copies >> 8) & 0xff,
            copies & 0xff,
        ];
        const payload13 = [...basePageInfo, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
        let pageAck = await sendCommandWaitAck(0x13, payload13, [0x14, 0xdb], 450);
        logTrace(`SetPageSize 13-byte ACK: ${pageAck ? '0x' + pageAck.cmd.toString(16) + ' [' + Array.from(pageAck.data) + ']' : 'timeout'}`);

        // Fallback: If 13-byte was rejected or timed out, try 45-byte (official PC SDK cPrinterV6 with 32 zero bytes) or 6-byte (V5)
        if (!pageAck || pageAck.cmd === 0xdb || (pageAck.data.length > 0 && pageAck.data[0] === 0)) {
            const payload45 = new Uint8Array(45);
            payload45.set(payload13, 0);
            pageAck = await sendCommandWaitAck(0x13, payload45, [0x14, 0xdb], 400);
            logTrace(`SetPageSize 45-byte ACK: ${pageAck ? '0x' + pageAck.cmd.toString(16) : 'timeout'}`);

            if (!pageAck || pageAck.cmd === 0xdb || (pageAck.data.length > 0 && pageAck.data[0] === 0)) {
                pageAck = await sendCommandWaitAck(0x13, basePageInfo, [0x14, 0xdb], 350);
                logTrace(`SetPageSize 6-byte ACK: ${pageAck ? '0x' + pageAck.cmd.toString(16) : 'timeout'}`);
            }
        }
    } else {
        // 2. Legacy PageStart / jcSetPagePrint (0x03, [0x01]) -> expects 0x04
        await sendCommandWaitAck(0x03, [0x01], 0x04, 300);

        // 3. SetPageSize / jcSetPageInfo (0x13, 6-byte)
        const pageInfoAck = await sendCommandWaitAck(
            0x13,
            [
                (reportedPageHeight >> 8) & 0xff,
                reportedPageHeight & 0xff,
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
                    (reportedPageHeight >> 8) & 0xff,
                    reportedPageHeight & 0xff,
                    (widthDots >> 8) & 0xff,
                    widthDots & 0xff,
                ],
                0x14,
                300
            );
        }
    }

    // 4. Package bitmap rows into run-length packets (exact match to Cb21Printer::commitJob in libjcPrinterSdk.dylib)
    // Run-length encoding collapses blank lines (0x84) and repeated lines (0x85)
    // - cnt0 = black pixels in x = 0..191   (bytes 0..23)
    // - cnt1 = black pixels in x = 192..383 (bytes 24..47)
    // - cnt2 = black pixels in x >= 384     (bytes 48..)
    const packets: Uint8Array[] = [];
    let y = 0;

    while (y < effectiveHeight) {
        const row = rows[y];
        let totalBits = 0;
        for (let i = 0; i < bytesPerRow; i++) {
            totalBits += popcount8(row[i]);
        }

        if (totalBits === 0) {
            let blankCount = 1;
            while (y + blankCount < effectiveHeight && blankCount < 250) {
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
            while (y + repeatCount < effectiveHeight && repeatCount < 250) {
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

    logTrace(`sendNiimbotPage: packaged ${packets.length} packets for rows 0..${effectiveHeight - 1}`);

    // 5. Send packets sequentially with paced delay
    // 10ms (BLE) / 2ms (USB) guarantees macOS CoreBluetooth doesn't drop packets during burst
    const paceMs = currentTransport === 'bluetooth' ? 10 : 2;
    for (const pkt of packets) {
        await sendRawPacket(pkt);
        await sleep(paceMs);
    }

    // 6. PageEnd / jcSetPageTerminal (0xE3, [0x01]) -> expects 0xE4
    // Allow printhead line-buffer to finish burning bottom rows before sending page terminal
    await sleep(160);
    // V4 hardware feed and burn can take up to 2-3 seconds, allow up to 10000ms
    const pageEndAck = await sendCommandWaitAck(0xe3, [0x01], [0xe4, 0xdb], 10000);
    logTrace(`PageEnd 0xE3 ACK: ${pageEndAck ? '0x' + pageEndAck.cmd.toString(16) : 'timeout'}`);

    // 7. Wait for physical printhead to finish feeding/printing copies (poll 0xA3 -> 0xB3 as in cPrinterV5::commitJob @ 0x101004)
    const maxWaitIterations = Math.min(30, 8 * copies);
    for (let poll = 0; poll < maxWaitIterations; poll++) {
        await sleep(180);
        const statusPkt = await sendCommandWaitAck(0xa3, [0x01], [0xb3, 0xdb], 250);
        if (statusPkt && statusPkt.cmd === 0xb3 && statusPkt.data.length >= 2) {
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
        density?: number; // 1..5 (default 1)
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

    const density = Math.min(5, Math.max(1, options?.density ?? 1));
    const dpi = options?.dpi ?? currentDpi;

    // Lay out labels onto physical sheets (split mode packs 2 labels per sheet: top / bottom)
    const sheets = buildPrintSheets(validItems, config);

    // Group consecutive identical sheets so the printer can repeat them as copies
    const sheetGroups: { slots: (Product | null)[]; copies: number }[] = [];
    const sheetKey = (slots: (Product | null)[]) => slots.map((p) => (p ? p.id : '-')).join('|');
    sheets.forEach((slots) => {
        const last = sheetGroups[sheetGroups.length - 1];
        if (last && sheetKey(last.slots) === sheetKey(slots)) {
            last.copies += 1;
        } else {
            sheetGroups.push({ slots, copies: 1 });
        }
    });

    const totalPages = sheets.length;
    const unitLabel = config.splitSheet ? 'แผ่น' : 'ดวง';

    options?.onProgress?.(0, totalPages, 'กำลังเตรียมหัวพิมพ์ NIIMBOT B2 Pro...');

    // 1. Set Print Density (0x21 -> 0x31/0x22) & Label Type (0x23 = 1 Gap Paper -> 0x33/0x24)
    await sendCommandWaitAck(0x21, [density], [0x31, 0x22], 350);
    await sendCommandWaitAck(0x23, [0x01], [0x33, 0x24], 350);

    // 2. StartJob / jcSetPrintAllTime (0x01 -> 0x02) with V4 9-byte / V5 8-byte payload
    await startNiimbotPrintJob(totalPages);

    let printedSoFar = 0;

    for (let i = 0; i < sheetGroups.length; i++) {
        const group = sheetGroups[i];
        const skuText = group.slots.map((p) => (p ? p.sku : 'ว่าง')).join(' / ');
        options?.onProgress?.(
            printedSoFar + 1,
            totalPages,
            `กำลังส่งพิมพ์ ${skuText} (${group.copies} ${unitLabel})...`
        );

        const encoded = encodeSheetToNiimbotRows(group.slots, config, dpi);
        await sendNiimbotPage(encoded, group.copies);
        printedSoFar += group.copies;

        options?.onProgress?.(
            printedSoFar,
            totalPages,
            `พิมพ์แล้ว ${printedSoFar}/${totalPages} ${unitLabel}`
        );
        await sleep(80);
    }

    // 3. PrintEnd / jcSetPrintTerminal (0xF3, [0x01] -> expects 0xF4)
    await sleep(100);
    const printEndAck = await sendCommandWaitAck(0xf3, [0x01], [0xf4, 0xdb], 600);
    logTrace(`PrintEnd 0xF3 ACK: ${printEndAck ? '0x' + printEndAck.cmd.toString(16) : 'timeout'}`);

    // B21 Pro post-print guard: send one-way Heartbeat (0xDC, [0x01]) to absorb trailing BLE drop
    try {
        await sendRawPacket(buildNiimbotPacket(0xdc, [0x01]));
        await sleep(40);
    } catch {
        // ignore
    }
}

/**
 * Print a physical calibration ruler (0 to 30 mm) directly to NIIMBOT B21
 * Allows the user to see the exact millimeter mark where thermal cutoff occurs on their machine.
 */
export async function printNiimbotRulerTest(options?: {
    dpi?: 203 | 300;
    density?: number;
    onProgress?: (msg: string) => void;
}): Promise<void> {
    const info = getNiimbotConnectionInfo();
    if (!info.connected) {
        await connectNiimbotBluetooth();
    }

    const dpi = options?.dpi ?? currentDpi;
    const density = Math.min(5, Math.max(1, options?.density ?? 1));
    const dotsPerMm = dpi === 300 ? 300 / 25.4 : 8;
    const widthMm = 40;
    const heightMm = 30;

    const rawLabelDotsW = Math.round(widthMm * dotsPerMm);
    const widthDots = Math.ceil(rawLabelDotsW / 8) * 8;
    const heightDots = Math.round(heightMm * dotsPerMm);
    const bytesPerRow = widthDots / 8;

    const canvas = document.createElement('canvas');
    canvas.width = widthDots;
    canvas.height = heightDots;
    const ctx = canvas.getContext('2d')!;

    // Pure white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, widthDots, heightDots);

    ctx.fillStyle = '#000000';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = Math.max(1, Math.round(dotsPerMm * 0.12));

    // Draw millimeter ruler tick marks down left & right edges
    for (let mm = 0; mm <= 30; mm++) {
        const y = Math.round(mm * dotsPerMm);
        if (y >= heightDots) break;

        const isMajor = mm % 5 === 0;
        const isCritical = mm >= 22;
        const tickLen = isMajor ? Math.round(dotsPerMm * 4.0) : Math.round(dotsPerMm * 2.0);

        // Left ticks
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(tickLen, y);
        ctx.stroke();

        // Right ticks
        ctx.beginPath();
        ctx.moveTo(widthDots - tickLen, y);
        ctx.lineTo(widthDots, y);
        ctx.stroke();

        if (isMajor || isCritical) {
            ctx.font = `bold ${Math.round(dotsPerMm * 1.7)}px sans-serif`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${mm}`, tickLen + 3, y);

            ctx.textAlign = 'right';
            ctx.fillText(`${mm}`, widthDots - tickLen - 3, y);
        }
    }

    // Mid die-cut marker at 14.5 mm
    const midY = Math.round(14.5 * dotsPerMm);
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(widthDots, midY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = `bold ${Math.round(dotsPerMm * 1.8)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('---- รอยตัดกึ่งกลาง (14.5 mm) ----', widthDots / 2, midY);

    // Center content for Slot 1 (Top)
    ctx.textBaseline = 'top';
    ctx.font = `bold ${Math.round(dotsPerMm * 2.2)}px sans-serif`;
    ctx.fillText('ไม้บรรทัดวัดระยะพิมพ์ (ดวงบน)', widthDots / 2, Math.round(1.5 * dotsPerMm));
    ctx.font = `600 ${Math.round(dotsPerMm * 1.8)}px sans-serif`;
    ctx.fillText('Azurite • CAB-AZU-001', widthDots / 2, Math.round(5.5 * dotsPerMm));
    ctx.fillText('11g • 3.3x2.2 cm • ฿1,500', widthDots / 2, Math.round(9 * dotsPerMm));

    // Center content for Slot 2 (Bottom)
    ctx.font = `bold ${Math.round(dotsPerMm * 2.2)}px sans-serif`;
    ctx.fillText('ไม้บรรทัดวัดระยะพิมพ์ (ดวงล่าง)', widthDots / 2, Math.round(16.0 * dotsPerMm));
    ctx.font = `600 ${Math.round(dotsPerMm * 1.8)}px sans-serif`;
    ctx.fillText('Seraphinite • CAB-SER-002', widthDots / 2, Math.round(19.5 * dotsPerMm));
    ctx.fillText('5g • 3.3x2 cm • ฿850', widthDots / 2, Math.round(22.8 * dotsPerMm));

    ctx.font = `bold ${Math.round(dotsPerMm * 1.5)}px sans-serif`;
    ctx.fillText('▲ สังเกตตัวเลขสุดท้ายที่ยิงติด ▲', widthDots / 2, Math.round(25.5 * dotsPerMm));

    // Extract rows and send
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
                rowBytes[x >> 3] |= 1 << (7 - (x & 7));
            }
        }
        rows.push(rowBytes);
    }

    options?.onProgress?.('กำลังส่งพิมพ์ไม้บรรทัดวัดระยะ (300 DPI)...');
    await sendCommandWaitAck(0x21, [density], [0x31, 0x22], 350);
    await sendCommandWaitAck(0x23, [0x01], [0x33, 0x24], 350);
    await startNiimbotPrintJob(1);
    await sendNiimbotPage({ widthDots, heightDots, bytesPerRow, rows }, 1);
    await sleep(100);
    const rulerEndAck = await sendCommandWaitAck(0xf3, [0x01], [0xf4, 0xdb], 600);
    logTrace(`Ruler PrintEnd 0xF3 ACK: ${rulerEndAck ? '0x' + rulerEndAck.cmd.toString(16) : 'timeout'}`);
    try {
        await sendRawPacket(buildNiimbotPacket(0xdc, [0x01]));
        await sleep(40);
    } catch {
        // ignore
    }
    options?.onProgress?.('พิมพ์ไม้บรรทัดสำเร็จ!');
}
