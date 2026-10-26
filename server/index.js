// Local / traditional server entry. On Vercel, api/index.js serves the same app as a function.
const app = require('./app');

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Denvio API running on http://localhost:${PORT}`));
