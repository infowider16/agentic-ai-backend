// Simple Vanilla JS Chat Widget
(function() {
  const currentScript = document.currentScript;
  const agentId = currentScript && currentScript.dataset.agentId ? currentScript.dataset.agentId : 'AGENT_123';
  const apiBaseUrl = currentScript && currentScript.dataset.apiBaseUrl ? currentScript.dataset.apiBaseUrl : window.location.origin;

  function initWidget() {
    if (!document.body || document.getElementById('agenticai-chat-bubble')) {
      return;
    }

    const style = document.createElement('style');
    style.innerHTML = `
      #agenticai-chat-bubble { position: fixed; bottom: 24px; right: 24px; z-index: 9999; }
      #agenticai-chat-bubble button { background:#0078d7;color:#fff;border:none;border-radius:50%;width:56px;height:56px;font-size:24px;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,0.18); }
      #agenticai-chat-box { display: none; position: fixed; bottom: 92px; right: 24px; width: 320px; background: #fff; border-radius: 8px; box-shadow: 0 2px 16px rgba(0,0,0,0.2); overflow: hidden; font-family: sans-serif; z-index: 9999; }
      #agenticai-chat-header { background: #0078d7; color: #fff; padding: 12px; font-weight: bold; }
      #agenticai-chat-messages { height: 240px; overflow-y: auto; padding: 12px; background: #f9f9f9; }
      #agenticai-chat-input-row { display: flex; border-top: 1px solid #eee; }
      #agenticai-chat-input { flex: 1; border: none; padding: 10px; font-size: 15px; }
      #agenticai-chat-send { background: #0078d7; color: #fff; border: none; padding: 0 18px; cursor: pointer; }
      .agenticai-chat-message { margin-bottom: 10px; line-height: 1.4; }
    `;
    document.head.appendChild(style);

    const bubble = document.createElement('div');
    bubble.id = 'agenticai-chat-bubble';
    bubble.innerHTML = '<button type="button" aria-label="Open chat">Chat</button>';
    document.body.appendChild(bubble);

    const box = document.createElement('div');
    box.id = 'agenticai-chat-box';
    box.innerHTML = `
      <div id="agenticai-chat-header">AI Agent</div>
      <div id="agenticai-chat-messages"></div>
      <div id="agenticai-chat-input-row">
        <input id="agenticai-chat-input" type="text" placeholder="Type your message..." />
        <button id="agenticai-chat-send" type="button">Send</button>
      </div>
    `;
    document.body.appendChild(box);

    bubble.onclick = function() {
      box.style.display = box.style.display === 'block' ? 'none' : 'block';
    };

    document.getElementById('agenticai-chat-send').onclick = sendMessage;
    document.getElementById('agenticai-chat-input').addEventListener('keydown', function(event) {
      if (event.key === 'Enter') {
        sendMessage();
      }
    });

    function sendMessage() {
      const input = document.getElementById('agenticai-chat-input');
      const msg = input.value.trim();
      if (!msg) {
        return;
      }

      addMessage('You', msg);
      input.value = '';

      fetch(apiBaseUrl + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: agentId, message: msg })
      })
        .then(function(res) {
          return res.json();
        })
        .then(function(data) {
          addMessage(data.agent_name || 'AI', data.reply || 'No reply');
        })
        .catch(function() {
          addMessage('AI', 'Error connecting to server.');
        });
    }

    function addMessage(sender, text) {
      const messages = document.getElementById('agenticai-chat-messages');
      const div = document.createElement('div');
      div.className = 'agenticai-chat-message';
      div.innerHTML = '<b>' + sender + ':</b> ' + text;
      messages.appendChild(div);
      messages.scrollTop = messages.scrollHeight;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWidget);
  } else {
    initWidget();
  }
})();
