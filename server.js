const express = require('express');
const cors = require('cors');
const path = require('path');
const chatRoutes = require('./routes/chat');
const knowledgeBaseRoutes = require('./routes/knowledgeBase');
const leadRoutes = require('./routes/leads');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

app.use('/api/chat', chatRoutes);
app.use('/api/knowledge-base', knowledgeBaseRoutes);
app.use('/api/leads', leadRoutes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'test-widget.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
