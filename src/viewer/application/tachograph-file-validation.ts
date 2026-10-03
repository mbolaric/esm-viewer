export function hasRecognizedTachographHeader(bytes: Uint8Array): boolean {
    const first = bytes[0];
    const second = bytes[1];

    return (
        (first === 0x00 && second === 0x02) ||
        (first === 0x76 && (second === 0x01 || second === 0x06 || second === 0x21 || second === 0x31))
    );
}
