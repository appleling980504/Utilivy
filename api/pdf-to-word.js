import { IncomingForm } from 'formidable';
import fs from 'fs';
import path from 'path';
import CloudConvert from 'cloudconvert';
import FormData from 'form-data';

export const config = {
  api: {
    bodyParser: false,
  },
};

// 动态导入 fetch 以避免 require 的 ESM 报错
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const cloudConvert = new CloudConvert(process.env.CLOUDCONVERT_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Only POST allowed');

  const form = new IncomingForm({ uploadDir: '/tmp', keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('Form parse error:', err);
      return res.status(500).json({ error: 'Form parse failed' });
    }

    const file = files.file;

    if (!file || !file.filepath) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
      // 1. 创建 CloudConvert Job
      const job = await cloudConvert.jobs.create({
        tasks: {
          importFile: {
            operation: 'import/upload',
          },
          convertFile: {
            operation: 'convert',
            input: 'importFile',
            input_format: 'pdf',
            output_format: 'docx',
          },
          exportFile: {
            operation: 'export/url',
            input: 'convertFile',
          },
        },
      });

      const uploadTask = job.tasks.find(t => t.name === 'importFile');
      const uploadUrl = uploadTask.result.form.url;
      const uploadParams = uploadTask.result.form.parameters;

      // 2. 上传文件
      const formData = new FormData();
      for (const [key, value] of Object.entries(uploadParams)) {
        formData.append(key, value);
      }
      formData.append('file', fs.createReadStream(file.filepath));

      await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
      });

      // 3. 等待任务完成
      const finishedJob = await cloudConvert.jobs.wait(job.id);
      const exportTask = finishedJob.tasks.find(t => t.name === 'exportFile');
      const fileUrl = exportTask.result.files[0].url;

      return res.status(200).json({ fileUrl });
    } catch (error) {
      console.error('CloudConvert error:', error);
      return res.status(500).json({ error: 'Conversion failed' });
    }
  });
}
