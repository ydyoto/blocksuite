import type {
  CollectionInfoSnapshot,
  Doc,
  DocCollection,
  DocSnapshot,
  JobMiddleware,
} from '@blocksuite/store';

import { assertExists, sha } from '@blocksuite/global/utils';
import { Job, extMimeMap, getAssetName } from '@blocksuite/store';

import { Unzip, Zip } from '../transformers/utils.js';
import { replaceIdMiddleware, titleMiddleware } from './middlewares.js';

async function exportDocs(collection: DocCollection, docs: Doc[]) {
  const zip = new Zip();
  const job = new Job({ collection });
  const snapshots = await Promise.all(docs.map(job.docToSnapshot));

  const collectionInfo = job.collectionInfoToSnapshot();
  await zip.file('info.json', JSON.stringify(collectionInfo, null, 2));

  await Promise.all(
    snapshots
      .filter((snapshot): snapshot is DocSnapshot => !!snapshot)
      .map(async snapshot => {
        const snapshotName = `${snapshot.meta.id}.snapshot.json`;
        await zip.file(snapshotName, JSON.stringify(snapshot, null, 2));
      })
  );

  const assets = zip.folder('assets');
  assertExists(assets);
  const assetsMap = job.assets;

  assetsMap.forEach((blob, id) => {
    const ext = getAssetName(assetsMap, id).split('.').at(-1);
    const name = `${id}.${ext}`;
    void assets.file(name, blob);
  });

  return zip.generate();
}

async function importDocs(collection: DocCollection, imported: Blob) {
  const zip = new Unzip();
  await zip.load(imported);

  const assetBlobs: [string, Blob][] = [];
  const snapshotsBlobs: Blob[] = [];
  let infoBlob: Blob | undefined;
  let info: CollectionInfoSnapshot | undefined;

  zip.iterate((name, blob) => {
    if (name.includes('MACOSX') || name.includes('DS_Store')) {
      return;
    }

    if (name.startsWith('assets/')) {
      assetBlobs.push([name, blob]);
      return;
    }

    if (name === 'info.json') {
      infoBlob = blob;
      return;
    }

    if (name.endsWith('.snapshot.json')) {
      snapshotsBlobs.push(blob);
      return;
    }
  });

  {
    const json = new TextDecoder().decode(await infoBlob?.arrayBuffer());
    info = JSON.parse(json) as CollectionInfoSnapshot;
  }

  const migrationMiddleware: JobMiddleware = ({ slots, collection }) => {
    slots.afterImport.on(payload => {
      if (payload.type === 'page') {
        collection.schema.upgradeDoc(
          info?.pageVersion ?? 0,
          {},
          payload.page.spaceDoc
        );
      }
    });
  };
  const job = new Job({
    collection,
    middlewares: [replaceIdMiddleware, migrationMiddleware, titleMiddleware],
  });
  const assetsMap = job.assets;

  await Promise.all(
    assetBlobs.map(([name, blob]) => {
      const nameWithExt = name.replace('assets/', '');
      const assetsId = nameWithExt.replace(/\.[^/.]+$/, '');
      const ext = nameWithExt.split('.').at(-1) ?? '';
      const mime = extMimeMap.get(ext) ?? '';
      const file = new File([blob], nameWithExt, {
        type: mime,
      });
      assetsMap.set(assetsId, file);
    })
  );

  return Promise.all(
    snapshotsBlobs.map(async blob => {
      const json = new TextDecoder().decode(await blob.arrayBuffer());
      const snapshot = JSON.parse(json) as DocSnapshot;
      const tasks: Promise<void>[] = [];

      job.walk(snapshot, block => {
        const sourceId = block.props?.sourceId as string | undefined;

        if (sourceId && sourceId.startsWith('/')) {
          const removeSlashId = sourceId.replace(/^\//, '');

          if (assetsMap.has(removeSlashId)) {
            const blob = assetsMap.get(removeSlashId)!;

            tasks.push(
              blob
                .arrayBuffer()
                .then(buffer => sha(buffer))
                .then(hash => {
                  assetsMap.set(hash, blob);
                  block.props.sourceId = hash;
                })
            );
          }
        }
      });

      await Promise.all(tasks);

      return job.snapshotToDoc(snapshot);
    })
  );
}

export const ZipTransformer = {
  exportDocs,
  importDocs,
};
