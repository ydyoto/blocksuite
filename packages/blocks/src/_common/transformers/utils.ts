import { getAssetName } from '@blocksuite/store';
import * as fflate from 'fflate';

export class Zip {
  private compressed = new Uint8Array();

  private finalize?: () => void;

  private finalized = false;

  private zip = new fflate.Zip((err, chunk, final) => {
    if (!err) {
      const temp = new Uint8Array(this.compressed.length + chunk.length);
      temp.set(this.compressed);
      temp.set(chunk, this.compressed.length);
      this.compressed = temp;
    }
    if (final) {
      this.finalized = true;
      this.finalize?.();
    }
  });

  async file(path: string, content: Blob | File | string) {
    const deflate = new fflate.ZipDeflate(path);
    this.zip.add(deflate);
    if (typeof content === 'string') {
      deflate.push(fflate.strToU8(content), true);
    } else {
      deflate.push(new Uint8Array(await content.arrayBuffer()), true);
    }
  }

  folder(folderPath: string) {
    return {
      folder: (folderPath2: string) => {
        return this.folder(`${folderPath}/${folderPath2}`);
      },
      file: async (name: string, blob: Blob) => {
        await this.file(`${folderPath}/${name}`, blob);
      },
      generate: async () => {
        return this.generate();
      },
    };
  }

  async generate() {
    this.zip.end();
    return new Promise<Blob>(resolve => {
      if (this.finalized) {
        resolve(new Blob([this.compressed], { type: 'application/zip' }));
      } else {
        this.finalize = () =>
          resolve(new Blob([this.compressed], { type: 'application/zip' }));
      }
    });
  }
}

export class Unzip {
  private unzip = new fflate.Unzip();

  private zippedUint8Array?: Uint8Array;

  constructor() {
    this.unzip.register(fflate.UnzipInflate);
  }

  iterate(handler: (path: string, content: Blob) => void) {
    if (!this.zippedUint8Array) return;
    this.unzip.onfile = file => {
      let content = new Uint8Array();
      file.ondata = (err, chunk, final) => {
        if (!err) {
          const temp = new Uint8Array(content.length + chunk.length);
          temp.set(content);
          temp.set(chunk, content.length);
          content = temp;
        }
        if (final) {
          handler(file.name, new Blob([content]));
        }
      };
      file.start();
    };
    this.unzip.push(this.zippedUint8Array, true);
  }

  async load(blob: Blob) {
    this.zippedUint8Array = new Uint8Array(await blob.arrayBuffer());
  }
}

export async function createAssetsArchive(
  assetsMap: Map<string, Blob>,
  assetsIds: string[]
) {
  const zip = new Zip();

  for (const [id, blob] of assetsMap) {
    if (!assetsIds.includes(id)) continue;
    const name = getAssetName(assetsMap, id);
    await zip.folder('assets').file(name, blob);
  }

  return zip;
}

export function download(blob: Blob, name: string) {
  const element = document.createElement('a');
  element.setAttribute('download', name);
  const fileURL = URL.createObjectURL(blob);
  element.setAttribute('href', fileURL);
  element.style.display = 'none';
  document.body.append(element);
  element.click();
  element.remove();
  URL.revokeObjectURL(fileURL);
}
