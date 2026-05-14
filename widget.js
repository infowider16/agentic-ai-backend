// Simple Vanilla JS Chat Widget
(function() {
  const currentScript = document.currentScript;
  const agentId = currentScript && currentScript.dataset.agentId ? currentScript.dataset.agentId : 'AGENT_123';
  const apiBaseUrl = currentScript && currentScript.dataset.apiBaseUrl ? currentScript.dataset.apiBaseUrl : window.location.origin;
  const agentName = currentScript && currentScript.dataset.agentName ? currentScript.dataset.agentName : 'AI Agent';
  const brandName = currentScript && currentScript.dataset.brandName ? currentScript.dataset.brandName : 'AgenticAI';
  const maxHistoryItems = 20;

  function createSessionId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }

    return 'session_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
  }

  function getStorageKey() {
    return 'agenticai:conversation:' + agentId;
  }

  function getConversationId() {
    const storageKey = getStorageKey();
    const storedValue = window.sessionStorage ? window.sessionStorage.getItem(storageKey) : '';

    if (storedValue) {
      return storedValue;
    }

    const nextValue = createSessionId();

    if (window.sessionStorage) {
      window.sessionStorage.setItem(storageKey, nextValue);
    }

    return nextValue;
  }

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

    const conversationId = getConversationId();
    const sessionId = conversationId;
    const conversationHistory = [];
    var leadFormShown = false;
    var lastUserMessage = '';

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
      .agenticai-chat-bubble-body { max-width: 82%; padding: 15px 27px; border-radius: 16px; background: #ffffff; box-shadow: 0 6px 18px rgba(15,23,42,0.06); }
      .agenticai-chat-bubble-row--user .agenticai-chat-bubble-body { background: linear-gradient(135deg, #6366F1 0%, #7C3AED 100%); color: #fff; border-radius: 16px 16px 4px 16px; }
      .agenticai-chat-bubble-row--agent .agenticai-chat-bubble-body { background: rgba(255,255,255,0.94); color: #17212b; border-radius: 16px 16px 16px 4px; }
      .agenticai-chat-meta { margin-bottom: 7px; font-size: 11px; font-weight: 600; color: #6d7890; letter-spacing: 0.01em; }
      .agenticai-chat-bubble-row--user .agenticai-chat-meta { color: rgba(255,255,255,0.78); }
      .agenticai-chat-summary { white-space: pre-line; }
      .agenticai-chat-list { margin: 8px 0 0; padding-left: 18px; word-break: break-word; white-space: pre-line; max-width: 100%; box-sizing: border-box; }
      .agenticai-chat-list li { margin-bottom: 4px; word-break: break-word; white-space: pre-line; max-width: 100%; box-sizing: border-box; }
      .agenticai-chat-cta { margin-top: 8px; font-weight: 600; }
      .agenticai-lead-form-bubble { max-width: 92% !important; }
      .agenticai-lead-form-title { font-size: 13px; color: #444f6b; margin-bottom: 10px; line-height: 1.5; }
      .agenticai-lead-form { display: flex; flex-direction: column; gap: 8px; }
      .agenticai-lead-input { width: 100%; box-sizing: border-box; border: 1px solid #e2e8f0; border-radius: 10px; padding: 9px 12px; font-size: 13px; color: #17212b; background: #f8fafc; outline: none; font-family: inherit; transition: border-color 0.15s; }
      .agenticai-lead-input:focus { border-color: #6366F1; background: #fff; }
      .agenticai-lead-textarea { resize: vertical; min-height: 60px; }
      .agenticai-lead-submit { background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); color: #fff; border: none; border-radius: 10px; padding: 10px 16px; font-size: 13px; font-weight: 600; cursor: pointer; margin-top: 2px; font-family: inherit; }
      .agenticai-lead-submit:disabled { opacity: 0.65; cursor: not-allowed; }
      .agenticai-lead-error { font-size: 12px; color: #dc2626; margin-top: 2px; display: none; }
      .agenticai-lead-success { font-size: 14px; color: #16a34a; font-weight: 600; padding: 6px 0; }
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

    function appendHistory(role, content) {
      const normalizedRole = role === 'assistant' ? 'assistant' : 'user';
      const normalizedContent = String(content || '').trim();

      if (!normalizedContent) {
        return;
      }

      conversationHistory.push({
        role: normalizedRole,
        content: normalizedContent
      });

      if (conversationHistory.length > maxHistoryItems) {
        conversationHistory.splice(0, conversationHistory.length - maxHistoryItems);
      }
    }

    function shouldTriggerLeadForm(triggerFlag) {
      return !leadFormShown && triggerFlag === true;
    }

    function showLeadForm(triggerReason, prefillQuestion) {
      leadFormShown = true;

      const messages = document.getElementById('agenticai-chat-messages');
      const row = document.createElement('div');
      row.className = 'agenticai-chat-message agenticai-chat-bubble-row agenticai-chat-bubble-row--agent';

      const avatarEl = document.createElement('div');
      avatarEl.className = 'agenticai-chat-message-avatar';
      avatarEl.innerHTML = createIcon('robot');

      const bubble = document.createElement('div');
      bubble.className = 'agenticai-chat-bubble-body agenticai-lead-form-bubble';

      const metaEl = document.createElement('div');
      metaEl.className = 'agenticai-chat-meta';
      metaEl.textContent = agentName;

      const titleEl = document.createElement('div');
      titleEl.className = 'agenticai-lead-form-title';
      titleEl.textContent = 'Please fill in your details and we\'ll get back to you shortly.';

      const formEl = document.createElement('div');
      formEl.className = 'agenticai-lead-form';

      const nameInput = document.createElement('input');
      nameInput.className = 'agenticai-lead-input';
      nameInput.type = 'text';
      nameInput.placeholder = 'Full Name *';
      nameInput.autocomplete = 'name';

      const emailInput = document.createElement('input');
      emailInput.className = 'agenticai-lead-input';
      emailInput.type = 'email';
      emailInput.placeholder = 'Work Email *';
      emailInput.autocomplete = 'email';

      const phoneInput = document.createElement('input');
      phoneInput.className = 'agenticai-lead-input';
      phoneInput.type = 'tel';
      phoneInput.placeholder = 'Phone Number (optional)';
      phoneInput.autocomplete = 'tel';

      const questionInput = document.createElement('textarea');
      questionInput.className = 'agenticai-lead-input agenticai-lead-textarea';
      questionInput.placeholder = 'Your question *';
      questionInput.rows = 3;
      questionInput.value = String(prefillQuestion || '');

      const errorEl = document.createElement('div');
      errorEl.className = 'agenticai-lead-error';

      const submitBtn = document.createElement('button');
      submitBtn.className = 'agenticai-lead-submit';
      submitBtn.type = 'button';
      submitBtn.textContent = 'Submit';

      formEl.appendChild(nameInput);
      formEl.appendChild(emailInput);
      formEl.appendChild(phoneInput);
      formEl.appendChild(questionInput);
      formEl.appendChild(errorEl);
      formEl.appendChild(submitBtn);
      bubble.appendChild(metaEl);
      bubble.appendChild(titleEl);
      bubble.appendChild(formEl);
      row.appendChild(avatarEl);
      row.appendChild(bubble);
      messages.appendChild(row);
      messages.scrollTop = messages.scrollHeight;

      submitBtn.onclick = function() {
        var name = nameInput.value.trim();
        var email = emailInput.value.trim();
        var phone = phoneInput.value.trim();
        var question = questionInput.value.trim();
        var emailRegex = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

        if (!name || !email || !question) {
          errorEl.textContent = 'Please fill in all required fields.';
          errorEl.style.display = 'block';
          return;
        }

        if (!emailRegex.test(email)) {
          errorEl.textContent = 'Please enter a valid email address.';
          errorEl.style.display = 'block';
          return;
        }

        errorEl.style.display = 'none';
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';

        fetch(apiBaseUrl + '/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agent_id: agentId,
            full_name: name,
            work_email: email,
            phone_number: phone || null,
            question: question,
            trigger_reason: triggerReason || 'cta'
          })
        })
          .then(function(res) {
            return res.json();
          })
          .then(function(data) {
            if (data && data.success) {
              while (bubble.firstChild) {
                bubble.removeChild(bubble.firstChild);
              }

              const successMeta = document.createElement('div');
              successMeta.className = 'agenticai-chat-meta';
              successMeta.textContent = agentName;

              const successMsg = document.createElement('div');
              successMsg.className = 'agenticai-lead-success';
              successMsg.textContent = 'Thank you! Our team will reach out to you soon.';

              bubble.appendChild(successMeta);
              bubble.appendChild(successMsg);
              messages.scrollTop = messages.scrollHeight;
            } else {
              submitBtn.disabled = false;
              submitBtn.textContent = 'Submit';
              errorEl.textContent = (data && data.error) || 'Something went wrong. Please try again.';
              errorEl.style.display = 'block';
            }
          })
          .catch(function() {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit';
            errorEl.textContent = 'Error connecting. Please try again.';
            errorEl.style.display = 'block';
          });
      };
    }

    function sendMessage() {
      const input = document.getElementById('agenticai-chat-input');
      const msg = input.value.trim();
      if (!msg) {
        return;
      }

      // Token expiry check
      var widgetToken = window.AI_Widget_Config && window.AI_Widget_Config.token;
      if (widgetToken) {
        try {
          var payload = JSON.parse(atob(widgetToken.split('.')[1]));
          if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
            addAgentMessage(agentName, 'Your session has expired. Please refresh the page to continue.');
            return;
          }
        } catch (e) { /* invalid token format, ignore */ }
      }

      lastUserMessage = msg;
      appendHistory('user', msg);
      addMessage('You', msg);
      input.value = '';
      setPendingState(true);
      addTypingIndicator();

      fetch(apiBaseUrl + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: agentId,
          message: msg,
          history: conversationHistory,
          session_id: sessionId,
          conversation_id: conversationId,
          token: (window.AI_Widget_Config && window.AI_Widget_Config.token) ? window.AI_Widget_Config.token : undefined
        })
      })
        .then(function(res) {
          return res.json();
        })
        .then(function(data) {
          removeTypingIndicator();
          if (!data || !data.reply) {
            addAgentMessage(agentName, data && data.error ? data.error : 'Sorry, I could not process that right now.');
            return;
          }

          appendHistory('assistant', data.reply);
          addAgentMessage(data.agent_name || agentName, data.reply, data.reply_blocks);

          if (shouldTriggerLeadForm(data.trigger_lead_form)) {
            setTimeout(function() {
              showLeadForm('cta', lastUserMessage);
            }, 350);
          }
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

      // Helper for typewriter effect
      function typeWriterEffect(element, text, cb) {
        let i = 0;
        function typeWriter() {
          if (i <= text.length) {
            element.textContent = text.slice(0, i);
            messages.scrollTop = messages.scrollHeight;
            i++;
            setTimeout(typeWriter, 18 + Math.random() * 30);
          } else if (cb) {
            cb();
          }
        }
        typeWriter();
      }

      // Compose all blocks as a sequence for animation
      let blocksToAnimate = [];
      if (hasStructuredBlocks) {
        if (blocks.summary) {
          blocksToAnimate.push({ type: 'summary', value: blocks.summary });
        }
        if (blocks.bullets && blocks.bullets.length) {
          blocks.bullets.forEach(function(item) {
            blocksToAnimate.push({ type: 'bullet', value: item });
          });
        }
        if (blocks.cta) {
          blocksToAnimate.push({ type: 'cta', value: blocks.cta });
        }
      } else if (normalizedText) {
        blocksToAnimate.push({ type: 'plain', value: normalizedText });
      }

      // Render with typewriter effect for all blocks
      function renderBlocks(index) {
        if (index >= blocksToAnimate.length) return;
        const block = blocksToAnimate[index];
        let el;
        if (block.type === 'summary') {
          el = document.createElement('div');
          el.className = 'agenticai-chat-summary';
        } else if (block.type === 'bullet') {
          // For bullets, animate each li separately
          let ul = bubble.querySelector('ul.agenticai-chat-list');
          if (!ul) {
            ul = document.createElement('ul');
            ul.className = 'agenticai-chat-list';
            bubble.appendChild(ul);
          }
          el = document.createElement('li');
          ul.appendChild(el);
        } else if (block.type === 'cta') {
          el = document.createElement('div');
          el.className = 'agenticai-chat-cta';
        } else {
          el = document.createElement('span');
        }
        bubble.appendChild(el);
        typeWriterEffect(el, block.value, function() {
          renderBlocks(index + 1);
        });
      }

      row.appendChild(avatar);
      row.appendChild(bubble);
      messages.appendChild(row);
      messages.scrollTop = messages.scrollHeight;

      if (blocksToAnimate.length > 0) {
        renderBlocks(0);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWidget);
  } else {
    initWidget();
  }
})();
