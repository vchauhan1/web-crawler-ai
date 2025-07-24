const express = require('express');
const router = express.Router();

// GET /api/v1/export
router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Export endpoint stub',
    timestamp: new Date().toISOString()
  });
});

// POST /api/v1/export/import
router.post('/import', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Import endpoint stub',
    timestamp: new Date().toISOString()
  });
});

module.exports = router; 