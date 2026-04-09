// Simple Vanilla JS Chat Widget
(function() {
  const currentScript = document.currentScript;
  const agentId = currentScript && currentScript.dataset.agentId ? currentScript.dataset.agentId : 'AGENT_123';
  const apiBaseUrl = currentScript && currentScript.dataset.apiBaseUrl ? currentScript.dataset.apiBaseUrl : window.location.origin;
  const agentName = currentScript && currentScript.dataset.agentName ? currentScript.dataset.agentName : 'AI Agent';
  const brandName = currentScript && currentScript.dataset.brandName ? currentScript.dataset.brandName : 'AgenticAI';

  function createIcon(type) {
    if (type === 'robot') {
      return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M9 2h6v2h-1v1.09A6.002 6.002 0 0 1 18 11v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4v-5a6.002 6.002 0 0 1 4-5.91V4H9V2Zm-1 9v5a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-5a4 4 0 0 0-8 0Zm2 1.5A1.5 1.5 0 1 1 8.5 14 1.5 1.5 0 0 1 10 12.5Zm4 0a1.5 1.5 0 1 1-1.5 1.5 1.5 1.5 0 0 1 1.5-1.5ZM9 8h6v1.5H9V8Z"/></svg>';
    }

    if (type === 'close') {
      return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M18.3 5.71 12 12l6.3 6.29-1.41 1.41L10.59 13.41 4.29 19.7 2.88 18.29 9.17 12 2.88 5.71 4.29 4.3l6.3 6.29 6.29-6.3 1.42 1.42Z"/></svg>';
    }

    if (type === 'send') {
      return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M3.4 20.4 20.85 12 3.4 3.6v6.54l12.2 1.86-12.2 1.86v6.54Z"/></svg>';
    }

    if (type === 'sparkle') {
      return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 3.25c.28 0 .52.18.6.45l1.09 3.66a2.2 2.2 0 0 0 1.46 1.46l3.66 1.09a.63.63 0 0 1 0 1.2l-3.66 1.09a2.2 2.2 0 0 0-1.46 1.46l-1.09 3.66a.63.63 0 0 1-1.2 0l-1.09-3.66a2.2 2.2 0 0 0-1.46-1.46L5.19 11.1a.63.63 0 0 1 0-1.2l3.66-1.09a2.2 2.2 0 0 0 1.46-1.46l1.09-3.66c.08-.27.32-.45.6-.45Z"/></svg>';
    }

    if (type === 'plus') {
      return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M19 11H13V5h-2v6H5v2h6v6h2v-6h6v-2Z"/></svg>';
    }

    return '';
  }

  function initWidget() {
    if (!document.body || document.getElementById('agenticai-chat-bubble')) {
      return;
    }

    const style = document.createElement('style');
    style.innerHTML = `
      #agenticai-chat-bubble { position: fixed; bottom: 24px; right: 24px; z-index: 9999; }
      #agenticai-chat-bubble button { display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%);color:#fff;border:none;border-radius:20px;width:60px;height:60px;cursor:pointer;box-shadow:0 18px 40px rgba(92,76,198,0.24); transition:transform 0.2s ease, box-shadow 0.2s ease; }
      #agenticai-chat-bubble button:hover { transform:translateY(-1px); box-shadow:0 22px 44px rgba(92,76,198,0.3); }
      #agenticai-chat-bubble svg { width:28px;height:28px;display:block; }
      #agenticai-chat-box { display: none; position: fixed; bottom: 100px; right: 24px; width: 360px; max-width: calc(100vw - 32px); background: #ffffff; border-radius: 24px; border: 1px solid rgba(148,163,184,0.16); box-shadow: 0 10px 25px rgba(15, 23, 42, 0.08), 0 24px 60px rgba(30,41,59,0.08); overflow: hidden; font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif; z-index: 9999; flex-direction: column; }
      #agenticai-chat-header { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; padding: 18px 18px 24px; background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); color: #fff; }
      #agenticai-chat-header-main { display:flex; align-items:center; gap:14px; min-width:0; }
      #agenticai-chat-avatar-shell { display:flex; align-items:center; justify-content:center; width:56px; height:56px; border-radius:999px; background:rgba(255,255,255,0.18); box-shadow:0 14px 30px rgba(6,25,84,0.2); flex-shrink:0; transform: translateY(12px); }
      #agenticai-chat-avatar { display:flex; align-items:center; justify-content:center; width:46px; height:46px; border-radius:999px; background:#ffffff; color:#5b4ee8; }
      #agenticai-chat-avatar svg { width:24px; height:24px; }
      #agenticai-chat-title-wrap { display:flex; align-items:center; min-width:0; min-height:56px; transform: translateY(12px); }
      #agenticai-chat-title { display:flex; align-items:center; gap:8px; margin-top:0; font-size:18px; font-weight:700; letter-spacing:0.01em; }
      #agenticai-chat-close { display:flex; align-items:center; justify-content:center; width:24px; height:24px; margin-top:4px; border:none; padding:0; background:transparent; color:rgba(255,255,255,0.78); cursor:pointer; flex-shrink:0; }
      #agenticai-chat-close svg { width:16px; height:16px; }
      #agenticai-chat-messages { display:flex; flex-direction:column; height: 300px; overflow-y: auto; padding: 22px 16px 10px; background-color:#F8FAFC; background-image: radial-gradient(rgba(226, 232, 240, 0.95) 1px, transparent 1px), linear-gradient(180deg, #F8FAFC 0%, #F4F7FB 100%); background-size: 16px 16px, 100% 100%; background-position: 0 0, 0 0; }
      #agenticai-chat-messages::-webkit-scrollbar { width: 8px; }
      #agenticai-chat-messages::-webkit-scrollbar-track { background: transparent; }
      #agenticai-chat-messages::-webkit-scrollbar-thumb { background: #c9d1e3; border-radius: 999px; }
      #agenticai-chat-messages { scrollbar-width: thin; scrollbar-color: #c9d1e3 transparent; }
      #agenticai-chat-input-shell { padding: 10px 14px 14px; background: linear-gradient(180deg, rgba(248,250,252,0.45) 0%, #F8FAFC 32%, #F8FAFC 100%); }
      #agenticai-chat-input-row { display: flex; align-items:center; gap:10px; padding: 8px 10px; border: 1px solid #F1F5F9; border-radius: 18px; background:#ffffff; box-shadow: 0 8px 18px rgba(15,23,42,0.05); }
      .agenticai-chat-icon-button { display:flex; align-items:center; justify-content:center; width:38px; height:38px; border:none; border-radius:12px; background:transparent; color:#6c7894; cursor:pointer; flex-shrink:0; }
      .agenticai-chat-icon-button svg { width:20px; height:20px; }
      #agenticai-chat-input { flex: 1; border: none; padding: 11px 4px; font-size: 14px; line-height:1.4; background: transparent; color:#17212b; }
      #agenticai-chat-input::placeholder { color:#95a0b8; }
      #agenticai-chat-input:focus { outline: none; }
      #agenticai-chat-send { display:flex; align-items:center; justify-content:center; background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); color: #fff; border: none; border-radius:999px; width: 40px; height: 40px; cursor: pointer; flex-shrink:0; box-shadow:0 8px 18px rgba(92,76,198,0.18); }
      #agenticai-chat-send svg { width:18px; height:18px; }
      #agenticai-chat-powered { margin-top: 10px; text-align:center; font-size:11px; color:#8a94aa; letter-spacing:0.01em; }
      .agenticai-chat-message { margin-bottom: 14px; line-height: 1.6; }
      .agenticai-chat-message span { white-space: pre-line; }
      .agenticai-chat-bubble-row { display: flex; align-items: flex-end; gap: 10px; }
      .agenticai-chat-bubble-row--user { justify-content: flex-end; }
      .agenticai-chat-bubble-row--agent { justify-content: flex-start; }
      .agenticai-chat-message-avatar { display:flex; align-items:center; justify-content:center; width:30px; height:30px; border-radius:999px; background:#ffffff; color:#5b4ee8; box-shadow:0 8px 18px rgba(15,23,42,0.08); flex-shrink:0; }
      .agenticai-chat-message-avatar svg { width:16px; height:16px; }
      .agenticai-chat-bubble-body { max-width: 82%; padding: 15px 19px; border-radius: 16px; background: #ffffff; box-shadow: 0 6px 18px rgba(15,23,42,0.06); }
      .agenticai-chat-bubble-row--user .agenticai-chat-bubble-body { background: linear-gradient(135deg, #6366F1 0%, #7C3AED 100%); color: #fff; border-radius: 16px 16px 4px 16px; }
      .agenticai-chat-bubble-row--agent .agenticai-chat-bubble-body { background: rgba(255,255,255,0.94); color: #17212b; border-radius: 16px 16px 16px 4px; }
      .agenticai-chat-meta { margin-bottom: 7px; font-size: 11px; font-weight: 600; color: #6d7890; letter-spacing: 0.01em; }
      .agenticai-chat-bubble-row--user .agenticai-chat-meta { color: rgba(255,255,255,0.78); }
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
      @media (max-width: 480px) {
        #agenticai-chat-bubble { right: 16px; bottom: 16px; }
        #agenticai-chat-box { right: 16px; bottom: 88px; width: calc(100vw - 32px); }
      }
    `;
    document.head.appendChild(style);

    const bubble = document.createElement('div');
    bubble.id = 'agenticai-chat-bubble';
    bubble.innerHTML = '<button type="button" aria-label="Open chat">' + createIcon('sparkle') + '</button>';
    document.body.appendChild(bubble);

    const box = document.createElement('div');
    box.id = 'agenticai-chat-box';
    box.innerHTML = `
      <div id="agenticai-chat-header">
        <div id="agenticai-chat-header-main">
          <div id="agenticai-chat-avatar-shell">
            <div id="agenticai-chat-avatar">${createIcon('robot')}</div>
          </div>
          <div id="agenticai-chat-title-wrap">
            <div id="agenticai-chat-title">${agentName}</div>
          </div>
        </div>
        <button id="agenticai-chat-close" type="button" aria-label="Close chat">${createIcon('close')}</button>
      </div>
      <div id="agenticai-chat-messages"></div>
      <div id="agenticai-chat-input-shell">
        <div id="agenticai-chat-input-row">         
          <input id="agenticai-chat-input" type="text" placeholder="Ask me anything..." />
          <button id="agenticai-chat-send" type="button" aria-label="Send message">${createIcon('send')}</button>
        </div>        
      </div>
    `;
    document.body.appendChild(box);

    bubble.onclick = function() {
      box.style.display = box.style.display === 'flex' ? 'none' : 'flex';
    };

    document.getElementById('agenticai-chat-close').onclick = function() {
      box.style.display = 'none';
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
      label.textContent = agentName + ' is thinking';
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
      const avatar = document.createElement('div');
      const normalizedText = String(text || '').trim();
      const hasStructuredBlocks = Boolean(
        blocks && (blocks.summary || (blocks.bullets && blocks.bullets.length) || blocks.cta)
      );

      row.className = 'agenticai-chat-message agenticai-chat-bubble-row agenticai-chat-bubble-row--agent';
      avatar.className = 'agenticai-chat-message-avatar';
      avatar.innerHTML = createIcon('robot');
      bubble.className = 'agenticai-chat-bubble-body';
      meta.className = 'agenticai-chat-meta';
      meta.textContent = sender;
      bubble.appendChild(meta);

      if (hasStructuredBlocks) {
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
      } else if (normalizedText) {
        const body = document.createElement('span');
        body.textContent = normalizedText;
        bubble.appendChild(body);
      }

      row.appendChild(avatar);
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
