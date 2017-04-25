// See http://dev.exiv2.org/projects/exiv2/wiki/The_Metadata_in_JPEG_files
const JPEG_MARKER_PREFIX = 0xFF,
      JPEG_START_MARKER = 0xD8,
      JPEG_EXIF_MARKER = 0xE1,
      JPEG_SOS_MARKER = 0xDA,
      TIFF_LITTLE_START = 0x49492A00,
      TIFF_BIG_START = 0x4D4D002A,
      TIFF_ORIENTATION_TAG = 0x0112;

// See http://jpegclub.org/exif_orientation.html
export enum ExifOrientation {
    NORMAL = 1,
    FLIP_HORIZONTAL,
    ROTATE_180_DEGREES,
    FLIP_VERTICAL,
    TRANSPOSE,
    ROTATE_90_DEGREES,
    TRANSVERSE,
    ROTATE_270_DEGREES
}

export interface JpegMetadata {
    orientation?: ExifOrientation;
}

/**
 * @class Reads and decodes metadata properties from JPEG binary data src
 */
export class JpegDecoder {
    private buffer: DataView;
    private bufferLength: number;
    private _metadata: JpegMetadata = {};

    private exifOrientationOffset: number;
    private exifLittleEndian: boolean;

    /**
     * @member {Object} metadata - all existing EXIF metadata properties decoded from the src
     */
    get metadata() {
        return this._metadata;
    }

    /**
     * @constructs
     * @param {ArrayBuffer} imageData - buffer containing binary data for the JPEG src image
     */
    constructor(imageData: ArrayBuffer) {
        this.buffer = new DataView(imageData);
        this.bufferLength = this.buffer.byteLength;

        // ensure the start of a valid jpeg
        if (this.buffer.getUint8(0) !== JPEG_MARKER_PREFIX ||
                this.buffer.getUint8(1) !== JPEG_START_MARKER) {
            throw new Error('Invalid JPEG src image data');
        }

        this.readMetadata();
    }

    setExifOrientation(value: ExifOrientation): void {
        if (this.exifOrientationOffset) {
            this.buffer.setUint16(this.exifOrientationOffset, value, this.exifLittleEndian);
        }
    }

    private readMetadata(): void {
        let offset = 2; // skip start marker
        let marker: number;

        // iterate over JPEG/JFIF binary data marker segments
        while (offset < this.bufferLength) {
            // check for the start of a valid 2 byte marker
            if (this.buffer.getUint8(offset) !== JPEG_MARKER_PREFIX) {
                throw new Error('Invalid marker');
            }

            marker = this.buffer.getUint8(offset + 1);

            // parse and decode the EXIF segment if it exists
            if (marker === JPEG_EXIF_MARKER) {
                this.readEXIFData(offset + 4);
                return; // only interested in EXIF metadata for now
            } else if (marker === JPEG_SOS_MARKER) {
                return; // this is the start of the image; all metadata must come before this marker
            }

            // move to the start of the next marker
            offset += 2 + this.buffer.getUint16(offset + 2); // marker + segment length
        }
    }

    private readEXIFData(start: number): void {
        if (this.getStringFromBytes(start, 4) !== 'Exif') {
            throw new Error('Invalid EXIF header');
        }

        const offset = start + 6;

        // check for TIFF validity and endianness
        let littleEndian: boolean;
        if (this.buffer.getUint32(offset) === TIFF_LITTLE_START) {
            littleEndian = true;
        } else if (this.buffer.getUint32(offset) === TIFF_BIG_START) {
            littleEndian = false;
        } else {
            throw new Error('Invalid TIFF header');
        }

        // keep track for calling any setter methods post-decoding
        this.exifLittleEndian = littleEndian;

        const ifdOffset = this.buffer.getUint32(offset + 4, littleEndian);
        const dirStart = offset + ifdOffset;
        const tagCount = this.buffer.getUint16(dirStart, littleEndian);

        // iterate over tag entries and decode their values
        let tagOffset: number, tag: number;
        for (let i = 0; i < tagCount; i++) {
            tagOffset = dirStart + 2 + i * 12; // 2 byte tagCount + 12 byte tags
            tag = this.buffer.getUint16(tagOffset, littleEndian);

            if (tag === TIFF_ORIENTATION_TAG) {
                this.exifOrientationOffset = tagOffset + 8;
                this._metadata.orientation = this.buffer.getUint16(this.exifOrientationOffset, littleEndian);

                return; // only interested in orientation tag for now
            }
        }
    }

    private getStringFromBytes(start: number, length: number): string {
        let str = '';
        for (let offset = start; offset < start + length; offset++) {
            str += String.fromCharCode(this.buffer.getUint8(offset));
        }

        return str;
    }

    static base64StrToImageData(str: string): ArrayBuffer {
        const binaryStr =  window.atob(str);
        const len = binaryStr.length;

        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++)        {
            bytes[i] = binaryStr.charCodeAt(i);
        }

        return bytes.buffer;
    }
}
