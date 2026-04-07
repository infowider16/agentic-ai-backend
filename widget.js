// Simple Vanilla JS Chat Widget
(function() {
  const currentScript = document.currentScript;
  const agentId = currentScript && currentScript.dataset.agentId ? currentScript.dataset.agentId : 'AGENT_123';
  const apiBaseUrl = currentScript && currentScript.dataset.apiBaseUrl ? currentScript.dataset.apiBaseUrl : window.location.origin;
  const agentName = currentScript && currentScript.dataset.agentName ? currentScript.dataset.agentName : 'AI Agent';
  function initWidget() {
    if (!document.body || document.getElementById('agenticai-chat-bubble')) {
      return;
    }

    const style = document.createElement('style');
    style.innerHTML = `
      #agenticai-chat-bubble { position: fixed; bottom: 24px; right: 24px; z-index: 9999; }
      #agenticai-chat-bubble button { display:flex;align-items:center;justify-content:center;background:#0078d7;color:#fff;border:none;border-radius:50%;width:56px;height:56px;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,0.18); }
      #agenticai-chat-bubble svg { width:28px;height:28px;display:block; }
      #agenticai-chat-box { display: none; position: fixed; bottom: 92px; right: 24px; width: 320px; background: #fff; border-radius: 8px; box-shadow: 0 2px 16px rgba(0,0,0,0.2); overflow: hidden; font-family: sans-serif; z-index: 9999; }
      #agenticai-chat-header { background: #0078d7; color: #fff; padding: 12px; font-weight: bold; }
      #agenticai-chat-messages { height: 240px; overflow-y: auto; padding: 12px; background: #f9f9f9; }
      #agenticai-chat-input-row { display: flex; border-top: 1px solid #eee; }
      #agenticai-chat-input { flex: 1; border: none; padding: 10px; font-size: 15px; }
      #agenticai-chat-send { background: #0078d7; color: #fff; border: none; padding: 0 18px; cursor: pointer; }
      .agenticai-chat-message { margin-bottom: 12px; line-height: 1.4; }
      .agenticai-chat-message span { white-space: pre-line; }
      .agenticai-chat-bubble-row { display: flex; }
      .agenticai-chat-bubble-row--user { justify-content: flex-end; }
      .agenticai-chat-bubble-row--agent { justify-content: flex-start; }
      .agenticai-chat-bubble-body { max-width: 85%; padding: 10px 12px; border-radius: 14px; background: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
      .agenticai-chat-bubble-row--user .agenticai-chat-bubble-body { background: #0078d7; color: #fff; border-bottom-right-radius: 4px; }
      .agenticai-chat-bubble-row--agent .agenticai-chat-bubble-body { background: #fff; color: #17212b; border-bottom-left-radius: 4px; }
      .agenticai-chat-meta { margin-bottom: 6px; font-size: 12px; font-weight: 700; opacity: 0.85; }
      .agenticai-chat-summary { white-space: pre-line; }
      .agenticai-chat-list { margin: 8px 0 0; padding-left: 18px; }
      .agenticai-chat-list li { margin-bottom: 4px; }
      .agenticai-chat-cta { margin-top: 8px; font-weight: 600; }
      .agenticai-chat-message--typing { color: #666; font-style: italic; }
      .agenticai-chat-typing-dots { display: inline-flex; margin-left: 4px; }
      .agenticai-chat-typing-dots span { animation: agenticaiTypingBlink 1.2s infinite; display: inline-block; }
      .agenticai-chat-typing-dots span:nth-child(2) { animation-delay: 0.2s; }
      .agenticai-chat-typing-dots span:nth-child(3) { animation-delay: 0.4s; }
      @keyframes agenticaiTypingBlink {
        0%, 80%, 100% { opacity: 0.25; transform: translateY(0); }
        40% { opacity: 1; transform: translateY(-1px); }
      }
    `;
    document.head.appendChild(style);

    const bubble = document.createElement('div');
    bubble.id = 'agenticai-chat-bubble';
    bubble.innerHTML = '<button type="button" aria-label="Open chat"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2C6.48 2 2 6.03 2 11c0 2.4 1.05 4.58 2.76 6.2L4 22l5.14-2.57c.9.24 1.86.37 2.86.37 5.52 0 10-4.03 10-9s-4.48-8.8-10-8.8Zm-4 8.3a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6Zm4 0a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6Zm4 0a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6Z"/></svg></button>';
    document.body.appendChild(bubble);

    const box = document.createElement('div');
    box.id = 'agenticai-chat-box';
    box.innerHTML = `
      <div id="agenticai-chat-header">${agentName}</div>
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

    function setPendingState(isPending) {
      document.getElementById('agenticai-chat-input').disabled = isPending;
      document.getElementById('agenticai-chat-send').disabled = isPending;
    }

    function removeTypingIndicator() {
      const indicator = document.getElementById('agenticai-chat-typing');

      if (indicator) {
        indicator.remove();
      }
    }

    function addTypingIndicator() {
      removeTypingIndicator();

      const messages = document.getElementById('agenticai-chat-messages');
      const div = document.createElement('div');
      const label = document.createElement('span');
      const dots = document.createElement('span');

      div.id = 'agenticai-chat-typing';
      div.className = 'agenticai-chat-message agenticai-chat-message--typing';
      label.textContent = agentName + ' is typing';
      dots.className = 'agenticai-chat-typing-dots';
      dots.innerHTML = '<span>.</span><span>.</span><span>.</span>';
      div.appendChild(label);
      div.appendChild(dots);
      messages.appendChild(div);
      messages.scrollTop = messages.scrollHeight;
    }

    function sendMessage() {
      const input = document.getElementById('agenticai-chat-input');
      const msg = input.value.trim();
      if (!msg) {
        return;
      }

      addMessage('You', msg);
      input.value = '';
      setPendingState(true);
      addTypingIndicator();

      fetch(apiBaseUrl + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: agentId, message: msg })
      })
        .then(function(res) {
          return res.json();
        })
        .then(function(data) {
          removeTypingIndicator();
          addAgentMessage(data.agent_name || agentName, data.reply || 'No reply', data.reply_blocks);
        })
        .catch(function() {
          removeTypingIndicator();
          addAgentMessage(agentName, 'Error connecting to server.');
        })
        .finally(function() {
          setPendingState(false);
          input.focus();
        });
    }

    function addMessage(sender, text) {
      const messages = document.getElementById('agenticai-chat-messages');
      const row = document.createElement('div');
      const bubble = document.createElement('div');
      const meta = document.createElement('div');
      const body = document.createElement('span');

      row.className = 'agenticai-chat-message agenticai-chat-bubble-row agenticai-chat-bubble-row--user';
      bubble.className = 'agenticai-chat-bubble-body';
      meta.className = 'agenticai-chat-meta';
      meta.textContent = sender;
      body.textContent = text;
      bubble.appendChild(meta);
      bubble.appendChild(body);
      row.appendChild(bubble);
      messages.appendChild(row);
      messages.scrollTop = messages.scrollHeight;
    }

    function addAgentMessage(sender, text, blocks) {
      const messages = document.getElementById('agenticai-chat-messages');
      const row = document.createElement('div');
      const bubble = document.createElement('div');
      const meta = document.createElement('div');

      row.className = 'agenticai-chat-message agenticai-chat-bubble-row agenticai-chat-bubble-row--agent';
      bubble.className = 'agenticai-chat-bubble-body';
      meta.className = 'agenticai-chat-meta';
      meta.textContent = sender;
      bubble.appendChild(meta);

      if (blocks && (blocks.summary || (blocks.bullets && blocks.bullets.length) || blocks.cta)) {
        if (blocks.summary) {
          const summary = document.createElement('div');
          summary.className = 'agenticai-chat-summary';
          summary.textContent = blocks.summary;
          bubble.appendChild(summary);
        }

        if (blocks.bullets && blocks.bullets.length) {
          const list = document.createElement('ul');
          list.className = 'agenticai-chat-list';
          blocks.bullets.forEach(function(item) {
            const listItem = document.createElement('li');
            listItem.textContent = item;
            list.appendChild(listItem);
          });
          bubble.appendChild(list);
        }

        if (blocks.cta) {
          const cta = document.createElement('div');
          cta.className = 'agenticai-chat-cta';
          cta.textContent = blocks.cta;
          bubble.appendChild(cta);
        }
      } else {
        const body = document.createElement('span');
        body.textContent = text;
        bubble.appendChild(body);
      }

      row.appendChild(bubble);
      messages.appendChild(row);
      messages.scrollTop = messages.scrollHeight;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWidget);
  } else {
    initWidget();
  }
})();
