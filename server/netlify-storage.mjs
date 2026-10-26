import initial from './initial-content.json' with { type: 'json' };

// Named site-wide stores survive deployments. Conditional writes prevent two
// independent function instances from overwriting each other's content changes.
export function createBlobStorage({ content, records, uploads }) {
  async function version(store, key) {
    const page = await store.list({ prefix: key });
    return page.blobs.find(blob => blob.key === key)?.etag;
  }
  async function readVersioned(store, key) {
    const current = await store.getWithMetadata(key, { type: 'json' });
    if (!current || current.etag) return current;
    // The official local Blobs emulator omits ETag on GET. Its LIST endpoint
    // exposes versions: bracket a fresh read and retry if that version changes.
    for (let attempt = 0; attempt < 12; attempt++) {
      const before = await version(store, key);
      const value = await store.getWithMetadata(key, { type: 'json' });
      const after = await version(store, key);
      if (!value && !after) return null;
      if (before && before === after && value) return { ...value, etag: after };
    }
    throw Object.assign(new Error('Dữ liệu đang được cập nhật. Vui lòng thử lại.'), { status: 409 });
  }
  async function mutate(store, key, fallback, update) {
    for (let attempt = 0; attempt < 12; attempt++) {
      const current = await readVersioned(store, key);
      const next = update(structuredClone(current?.data ?? fallback));
      const options = current ? { onlyIfMatch: current.etag } : { onlyIfNew: true };
      const result = await store.setJSON(key, next, options);
      if (result.modified) return next;
    }
    throw Object.assign(new Error('Dữ liệu đang được cập nhật. Vui lòng thử lại.'), { status: 409 });
  }
  async function list(prefix) {
    const values = [];
    for await (const page of records.list({ prefix, paginate: true })) {
      const entries = await Promise.all(page.blobs.map(blob => records.get(blob.key, { type: 'json' })));
      values.push(...entries.filter(Boolean));
    }
    return values.sort((a, b) => b.created.localeCompare(a.created));
  }
  return {
    async getContent() { return (await content.get('website', { type: 'json' })) ?? structuredClone(initial); },
    updateContent(update) { return mutate(content, 'website', initial, update); },
    getSession(key) { return records.get('sessions/' + key, { type: 'json' }); },
    putSession(key, session) { return records.setJSON('sessions/' + key, session); },
    deleteSession(key) { return records.delete('sessions/' + key); },
    async consumeLimit(key, maximum, windowMs) {
      const now = Date.now();
      const value = await mutate(records, 'limits/' + key, null, current => {
        if (!current || current.until <= now) return { count: 1, until: now + windowMs };
        return { ...current, count: Math.min(current.count + 1, maximum + 1) };
      });
      return value.count > maximum;
    },
    listMedia() { return list('media/'); },
    async putMedia(item, bytes, contentType) {
      await uploads.set(item.url.slice('/uploads/'.length), bytes, { metadata: { contentType } });
      await records.setJSON('media/' + item.id, item);
    },
    getUpload(key) { return uploads.getWithMetadata(key, { type: 'arrayBuffer' }); },
    listMessages() { return list('messages/'); },
    putMessage(item) { return records.setJSON('messages/' + item.id, item); },
    updateMessage(id, status) {
      return mutate(records, 'messages/' + id, null, current => {
        if (!current) throw Object.assign(new Error('Không tìm thấy tin nhắn.'), { status: 404 });
        return { ...current, status };
      });
    },
  };
}
