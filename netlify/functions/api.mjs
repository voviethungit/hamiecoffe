import { getStore } from '@netlify/blobs';
import { createBlobStorage } from '../../server/netlify-storage.mjs';
import { createNetlifyAPI } from '../../server/netlify-api.mjs';

export default async (request, context) => {
  // Resolve Netlify's automatic Blobs credentials inside the request context.
  // No SQLite files, process-local sessions or ephemeral upload directories.
  const storage = createBlobStorage({
    content: getStore({ name: 'hamie-content', consistency: 'strong' }),
    records: getStore({ name: 'hamie-private', consistency: 'strong' }),
    uploads: getStore({ name: 'hamie-uploads', consistency: 'strong' }),
  });
  return createNetlifyAPI(storage)(request, context);
};
