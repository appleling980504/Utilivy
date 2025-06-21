import formidable from 'formidable';
import fs from 'fs';
import cloudconvert from 'cloudconvert';

export const config = {
  api: {
    bodyParser: false,
  },
};

const cloudConvert = new cloudconvert(process.env.CLOUDCONVERT_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Only POST allowed');

  const form = new formidable.IncomingForm({ keepExtensions: true });
  form.parse(req, async (err, fields, files) => {
    if (err || !files.file) return res.status(400).json({ error: 'File upload failed' });

    const inputFile = fs.createReadStream(files.file.filepath);

    try {
      const job = await cloudConvert.jobs.create({
        tasks: {
          'import-my-file': {
            operation: 'import/upload'
          },
          'convert-my-file': {
            operation: 'convert',
            input: 'import-my-file',
            input_format: 'pdf',
            output_format: 'docx'
          },
          'export-my-file': {
            operation: 'export/url',
            input: 'convert-my-file'
          }
        }
      });

      const uploadTask = job.tasks.find(t => t.name === 'import-my-file');
      await cloudConvert.tasks.upload(uploadTask, inputFile);

      const completedJob = await cloudConvert.jobs.wait(job.id); // wait for conversion
      const exportTask = completedJob.tasks.find(t => t.name === 'export-my-file' && t.status === 'finished');
      const fileUrl = exportTask.result.files[0].url;

      return res.status(200).json({ url: fileUrl });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'CloudConvert failed' });
    }
  });
}
