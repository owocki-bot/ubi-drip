/**
 * UBI Drip - Weekly distribution dashboard
 * Manages ETH and $owockibot token distributions to contributors
 */

const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());

// Supabase setup (optional - will use in-memory config if not available)
let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
}

// Contract addresses (Base mainnet)
const CONTRACT_ADDRESS = process.env.UBI_CONTRACT || '0x0000000000000000000000000000000000000000'; // Deploy pending
const OWOCKIBOT_TOKEN = '0x9e2fa44587156f0e3369ebc6e05d85e03afbca3f'; // $owockibot on Base
const ADMIN_WALLET = '0x4C3a28d81C52F5cA03cD7E1c8B3C02b396937ADC'; // Kevin's wallet

// Default rates (can be updated via admin)
let config = {
  ethPerRecipient: '0.01', // 0.01 ETH per week
  tokensPerRecipient: '1000', // 1000 $owockibot per week
  recipients: [
    { address: '0x8f69c8eb92ed068aa577ce1847d568b39b0d9ebf', label: '@Mutheu_developer' },
    // Wastelander address TBD - need to get from them
  ]
};

// Store in Supabase if available
async function loadConfig() {
  if (!supabase) return; // Use default in-memory config
  try {
    const { data } = await supabase.from('ubi_config').select('*').single();
    if (data) config = { ...config, ...data.config };
  } catch (e) {
    console.log('Using default config');
  }
}

async function saveConfig() {
  if (!supabase) return; // Config stays in memory only
  try {
    await supabase.from('ubi_config').upsert({ id: 1, config, updated_at: new Date().toISOString() });
  } catch (e) {
    console.log('Config save failed:', e.message);
  }
}

// HTML escape
const esc = (s) => String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c]));

/**
 * Admin Dashboard
 */
app.get('/', async (req, res) => {
  await loadConfig();
  
  const recipientRows = config.recipients.map((r, i) => `
    <tr>
      <td><code>${esc(r.address.slice(0, 6))}...${esc(r.address.slice(-4))}</code></td>
      <td>${esc(r.label || 'Unnamed')}</td>
      <td>
        <button class="btn-remove" onclick="removeRecipient('${esc(r.address)}')">Remove</button>
      </td>
    </tr>
  `).join('');

  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>UBI Drip | owockibot</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #0a0a1a 0%, #1a1a3a 100%);
      color: #fff;
      min-height: 100vh;
      padding: 2rem;
    }
    .container { max-width: 800px; margin: 0 auto; }
    h1 { font-size: 2rem; margin-bottom: 0.5rem; }
    h1 span { color: #00d4ff; }
    .subtitle { color: #888; margin-bottom: 2rem; }
    
    .card {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 16px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }
    .card h2 { font-size: 1.1rem; margin-bottom: 1rem; color: #00d4ff; }
    
    .rates-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }
    .rate-input {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .rate-input label { font-size: 0.9rem; color: #aaa; }
    .rate-input input {
      background: rgba(0,0,0,0.3);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 8px;
      padding: 0.75rem;
      color: #fff;
      font-size: 1rem;
    }
    .rate-input input:focus {
      outline: none;
      border-color: #00d4ff;
    }
    .rate-input .unit { font-size: 0.8rem; color: #666; }
    
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      padding: 0.75rem;
      text-align: left;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    th { color: #888; font-weight: 500; font-size: 0.85rem; }
    
    .btn {
      background: linear-gradient(135deg, #00d4ff, #0099cc);
      border: none;
      border-radius: 8px;
      padding: 0.75rem 1.5rem;
      color: #000;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s;
    }
    .btn:hover { transform: translateY(-2px); }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    
    .btn-remove {
      background: rgba(255,100,100,0.2);
      border: 1px solid rgba(255,100,100,0.3);
      border-radius: 6px;
      padding: 0.4rem 0.8rem;
      color: #ff6b6b;
      cursor: pointer;
      font-size: 0.85rem;
    }
    .btn-remove:hover { background: rgba(255,100,100,0.3); }
    
    .btn-secondary {
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.2);
      color: #fff;
    }
    
    .add-form {
      display: flex;
      gap: 0.5rem;
      margin-top: 1rem;
    }
    .add-form input {
      flex: 1;
      background: rgba(0,0,0,0.3);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 8px;
      padding: 0.75rem;
      color: #fff;
    }
    
    .stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .stat {
      background: rgba(0,212,255,0.1);
      border-radius: 12px;
      padding: 1rem;
      text-align: center;
    }
    .stat-value { font-size: 1.5rem; font-weight: bold; color: #00d4ff; }
    .stat-label { font-size: 0.8rem; color: #888; margin-top: 0.25rem; }
    
    .distribute-section {
      text-align: center;
      padding: 1rem 0;
    }
    .distribute-section .cost {
      color: #888;
      font-size: 0.9rem;
      margin-top: 1rem;
    }
    
    .wallet-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.5rem;
      padding: 1rem;
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
    }
    .wallet-status { display: flex; align-items: center; gap: 0.5rem; }
    .wallet-dot { width: 8px; height: 8px; border-radius: 50%; background: #ff6b6b; }
    .wallet-dot.connected { background: #4ade80; }
    
    .warning {
      background: rgba(255,200,0,0.1);
      border: 1px solid rgba(255,200,0,0.3);
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 1rem;
      color: #ffd700;
      font-size: 0.9rem;
    }
    
    .footer {
      text-align: center;
      margin-top: 2rem;
      color: #666;
      font-size: 0.85rem;
    }
    .footer a { color: #00d4ff; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <h1>💧 <span>UBI</span> Drip</h1>
    <p class="subtitle">Weekly contributor compensation for the owockibot ecosystem</p>
    
    <div class="wallet-bar">
      <div class="wallet-status">
        <div class="wallet-dot" id="wallet-dot"></div>
        <span id="wallet-status">Not connected</span>
      </div>
      <button class="btn btn-secondary" id="connect-btn" onclick="connectWallet()">Connect Wallet</button>
    </div>
    
    <div class="warning">
      ⚠️ <strong>QA Mode</strong> — Contract deployed but unfunded. Admin: ${esc(ADMIN_WALLET.slice(0,6))}...${esc(ADMIN_WALLET.slice(-4))}
    </div>
    
    <div class="stats">
      <div class="stat">
        <div class="stat-value">${config.recipients.length}</div>
        <div class="stat-label">Recipients</div>
      </div>
      <div class="stat">
        <div class="stat-value">${config.ethPerRecipient}</div>
        <div class="stat-label">ETH / week</div>
      </div>
      <div class="stat">
        <div class="stat-value">${Number(config.tokensPerRecipient).toLocaleString()}</div>
        <div class="stat-label">$owockibot / week</div>
      </div>
    </div>
    
    <div class="card">
      <h2>⚙️ Weekly Rates (per recipient)</h2>
      <div class="rates-grid">
        <div class="rate-input">
          <label>ETH per recipient</label>
          <input type="text" id="eth-rate" value="${esc(config.ethPerRecipient)}" placeholder="0.01">
          <span class="unit">ETH / week</span>
        </div>
        <div class="rate-input">
          <label>$owockibot per recipient</label>
          <input type="text" id="token-rate" value="${esc(config.tokensPerRecipient)}" placeholder="1000">
          <span class="unit">tokens / week</span>
        </div>
      </div>
      <div style="margin-top: 1rem;">
        <button class="btn btn-secondary" onclick="updateRates()">Save Rates</button>
      </div>
    </div>
    
    <div class="card">
      <h2>👥 Recipients</h2>
      <table>
        <thead>
          <tr>
            <th>Address</th>
            <th>Label</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="recipients-table">
          ${recipientRows || '<tr><td colspan="3" style="color:#888;text-align:center;">No recipients yet</td></tr>'}
        </tbody>
      </table>
      <div class="add-form">
        <input type="text" id="new-address" placeholder="0x... wallet address">
        <input type="text" id="new-label" placeholder="@username (optional)" style="max-width: 150px;">
        <button class="btn btn-secondary" onclick="addRecipient()">+ Add</button>
      </div>
    </div>
    
    <div class="card">
      <h2>💰 Distribution</h2>
      <div class="distribute-section">
        <button class="btn" id="distribute-btn" onclick="distribute()" disabled>
          💧 Distribute Weekly UBI
        </button>
        <p class="cost">
          Cost: <strong>${(parseFloat(config.ethPerRecipient) * config.recipients.length).toFixed(4)} ETH</strong> + 
          <strong>${(parseInt(config.tokensPerRecipient) * config.recipients.length).toLocaleString()} $owockibot</strong>
        </p>
        <p class="cost" style="margin-top: 0.5rem;">
          Contract: <code>${CONTRACT_ADDRESS.slice(0,6)}...${CONTRACT_ADDRESS.slice(-4)}</code>
        </p>
      </div>
    </div>
    
    <div class="footer">
      <p>Part of the <a href="https://owockibot.xyz">owockibot</a> ecosystem</p>
      <p style="margin-top: 0.5rem;">Contract: <a href="https://basescan.org/address/${CONTRACT_ADDRESS}" target="_blank">${CONTRACT_ADDRESS.slice(0,10)}...</a></p>
    </div>
  </div>
  
  <script>
    let connectedAddress = null;
    const ADMIN = '${ADMIN_WALLET}'.toLowerCase();
    
    async function connectWallet() {
      if (!window.ethereum) {
        alert('Please install MetaMask');
        return;
      }
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        connectedAddress = accounts[0].toLowerCase();
        document.getElementById('wallet-dot').classList.add('connected');
        document.getElementById('wallet-status').textContent = connectedAddress.slice(0,6) + '...' + connectedAddress.slice(-4);
        document.getElementById('connect-btn').textContent = 'Connected';
        
        if (connectedAddress === ADMIN) {
          document.getElementById('distribute-btn').disabled = false;
        }
      } catch (e) {
        console.error(e);
      }
    }
    
    async function updateRates() {
      const eth = document.getElementById('eth-rate').value;
      const tokens = document.getElementById('token-rate').value;
      
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ethPerRecipient: eth, tokensPerRecipient: tokens })
      });
      
      if (res.ok) {
        alert('Rates updated!');
        location.reload();
      } else {
        alert('Failed to update rates');
      }
    }
    
    async function addRecipient() {
      const address = document.getElementById('new-address').value.trim();
      const label = document.getElementById('new-label').value.trim();
      
      if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
        alert('Invalid address');
        return;
      }
      
      const res = await fetch('/api/recipients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, label })
      });
      
      if (res.ok) {
        location.reload();
      } else {
        alert('Failed to add recipient');
      }
    }
    
    async function removeRecipient(address) {
      if (!confirm('Remove this recipient?')) return;
      
      const res = await fetch('/api/recipients/' + address, { method: 'DELETE' });
      if (res.ok) {
        location.reload();
      } else {
        alert('Failed to remove recipient');
      }
    }
    
    async function distribute() {
      if (connectedAddress !== ADMIN) {
        alert('Only admin can distribute');
        return;
      }
      
      alert('Distribution would happen here via contract call. Contract not yet funded for QA.');
    }
    
    // Auto-connect if previously connected
    if (window.ethereum && window.ethereum.selectedAddress) {
      connectWallet();
    }
  </script>
</body>
</html>
  `);
});

/**
 * API: Get config
 */
app.get('/api/config', async (req, res) => {
  await loadConfig();
  res.json(config);
});

/**
 * API: Update config (rates)
 */
app.post('/api/config', async (req, res) => {
  const { ethPerRecipient, tokensPerRecipient } = req.body;
  
  if (ethPerRecipient) config.ethPerRecipient = ethPerRecipient;
  if (tokensPerRecipient) config.tokensPerRecipient = tokensPerRecipient;
  
  await saveConfig();
  res.json({ success: true, config });
});

/**
 * API: Add recipient
 */
app.post('/api/recipients', async (req, res) => {
  const { address, label } = req.body;
  
  if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
    return res.status(400).json({ error: 'Invalid address' });
  }
  
  // Check if already exists
  if (config.recipients.find(r => r.address.toLowerCase() === address.toLowerCase())) {
    return res.status(400).json({ error: 'Recipient already exists' });
  }
  
  config.recipients.push({ address: address.toLowerCase(), label: label || '' });
  await saveConfig();
  
  res.json({ success: true, recipients: config.recipients });
});

/**
 * API: Remove recipient
 */
app.delete('/api/recipients/:address', async (req, res) => {
  const address = req.params.address.toLowerCase();
  
  config.recipients = config.recipients.filter(r => r.address.toLowerCase() !== address);
  await saveConfig();
  
  res.json({ success: true, recipients: config.recipients });
});

/**
 * API: Get recipients
 */
app.get('/api/recipients', async (req, res) => {
  await loadConfig();
  res.json(config.recipients);
});

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`UBI Drip running on port ${PORT}`));

module.exports = app;
