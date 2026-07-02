import 'dotenv/config';
import { createApp } from './app.js';

const PORT = process.env.PORT || 3000;
const app = await createApp();

app.listen(PORT, () => {
  console.log(`Nobel Kurs Merkezi — http://localhost:${PORT}`);
});
