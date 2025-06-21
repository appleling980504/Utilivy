import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Readable } from 'stream';
import pkg from 'cloudconvert';

const CloudConvert = pkg.default;
const cloudConvert = new CloudConvert(process.env.CLOUDCONVERT_API_KEY);

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Only POST allowed');

  const form = formidable({ multiples: false });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('Form parse error:', err);
      return res.status(500).json({ error: 'Error parsing form' });
    }

    const file = files.file;
    if (!file || !file.filepath || file.size === 0) {
      console.error('Invalid file uploaded:', file);
      return res.status(400).json({ error: 'Invalid or empty file uploaded' });
    }

    console.log('✅ Uploaded file:', {
      filepath: file.filepath,
      size: file.size,
      mimetype: file.mimetype,
    });

    try {
      const job = await cloudConvert.jobs.create({
        tasks: {
          upload: {
            operation: 'import/upload',
          },
          compress: {
            operation: 'optimize',
            input: 'upload',
            output_format: 'pdf',
          },
          export: {
            operation: 'export/url',
            input: 'compress',
          },
        },
      });

      console.log('📦 Job created:', JSON.stringify(job, null, 2));

      const uploadTask = job.tasks.find((t) => t.name === 'upload');

      const inputFileStream = fs.createReadStream(file.filepath);

      await cloudConvert.tasks.upload(uploadTask, inputFileStream, path.basename(file.filepath));

      const finishedJob = await cloudConvert.jobs.wait(job.id); // Wait for job to finish

      console.log('✅ Job finished:', JSON.stringify(finishedJob, null, 2));

      const exportTask = finishedJob.tasks.find((t) => t.name === 'export');

      if (!exportTask || !exportTask.result || !exportTask.result.files) {
        console.error('Export task failed or missing:', exportTask);
        return res.status(500).json({ error: 'Export failed' });
      }

      const fileUrl = exportTask.result.files[0].url;

      console.log('🔗 Compressed file URL:', fileUrl);

      return res.status(200).json({ url: fileUrl });
    } catch (error) {
      console.error('❌ Compression failed:', error);
      return res.status(500).json({ error: 'Compression failed', detail: error.message });
    }
  });
}
