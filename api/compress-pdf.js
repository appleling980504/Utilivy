import formidable from 'formidable';
import fs from 'fs';
import { Readable } from 'stream';
import CloudConvert from 'cloudconvert'; // ✅ 注意大小写

export const config = {
  api: {
    bodyParser: false,
  },
};

const cloudConvert = new CloudConvert(process.env.CLOUDCONVERT_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end('Only POST allowed');
  }

  const form = new formidable.IncomingForm({ keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('Form parse error:', err);
      return res.status(500).json({ error: 'Failed to parse form data' });
    }

    const file = files.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
      const inputStream = fs.createReadStream(file.filepath);

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

      const uploadTask = job.tasks.find(task => task.name === 'upload');

      await cloudConvert.tasks.upload(uploadTask, inputStream, file.originalFilename);

      const completedJob = await cloudConvert.jobs.wait(job.id); // wait until job finishes
      const exportTask = completedJob.tasks.find(task => task.name === 'export');

      const fileUrl = exportTask.result.files[0].url;
      return res.status(200).json({ url: fileUrl });
    } catch (error) {
      console.error('Compression error:', error);
      return res.status(500).json({ error: 'Compression failed' });
    }
  });
}
