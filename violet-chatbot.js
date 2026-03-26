(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════
  // VIOLET CHATBOT WIDGET — Reusable Voice + Text Chat
  // Groq (GPT OSS 120B) + ElevenLabs Pro + Web Speech API
  // ═══════════════════════════════════════════════════════

  const CFG = Object.assign({
    name: 'Violet Chat',
    subtitle: 'AI Assistant',
    personality: 'echo',
    voiceId: 'vkeIzGivnbwEi5AOMj9S',
    accentColor: '#8A2BE2',
    groqModel: 'openai/gpt-oss-120b',
    welcomeMessage: null,
    position: 'right',
    maxTokens: 300,
    logoUrl: null, // URL to logo image (replaces initials)
    continuousListening: true, // auto-restart mic after AI speaks
  }, window.VIOLET_CHAT_CONFIG || {});

  // ── System Prompts ──
  const PROMPTS = {
    echo: `You are Violet Echo, the AI brand ambassador for Violet Media — a cinematic, musical, and AI-powered creative house engineered for the new era. Based in Perth, Australia. Tagline: "Where vision meets vibration."

ABOUT VIOLET MEDIA:
- Designs and delivers cinematic, narrative-driven visual and audio campaigns blending AI technology with human artistry
- Creates original music (Deep House, Ethereal Cosmic Pop), AI-generated music videos, ultra-realistic voice characters, and strategic AI content consulting
- Brands include Cosmic Tease (music and entertainment) and Violet Web Design at web.violetmedia.org
- AI-human co-creation model — "we don't just use AI, we co-create with it"
- Proprietary AI toolkit including WaveSpeed AI, ElevenLabs, Nano Banana Pro, and 600+ AI models
- Official WaveSpeed AI Partner Creator and ElevenLabs partner
- Proven reach: 14M+ views, 718K likes, 10K shares, 98.5% For You Page traffic
- Contact: violetmediastudio@gmail.com
- Social media: TikTok, YouTube, LinkedIn
- Based in Perth, Australia, serving clients globally

SERVICES:
1. Original Music Production — Deep House, Ethereal Cosmic Pop, AI-generated pop tracks for sync licensing and commercial release. Engineered for emotional impact and viral retention.
2. Music Video Production — Full cinematic videos using AI-generated imagery, hyper-realistic visual storytelling, and 8K image generation via Nano Banana Pro.
3. AI Voice and Lipsync Services — Ultra-realistic voice characters (Nova Violet, Violet Echo, Stella, Violet Myst) using ElevenLabs Pro and InfiniteTalk for podcasts, ads, explainers, documentaries, and avatar generation.
4. Strategic AI Content Consulting — Guidance on AI stack selection, workflow design, and brand identity for creators building AI-powered content systems.
5. Sponsored Content and Co-Creation Partnerships — Joint campaigns, product integrations, and sponsorships leveraging the 14M+ view audience.
6. Interactive Entertainment Development — Arcade-grade interactive experiences with cinematic motion using WaveSpeed AI.
7. Web Design — Cinematic websites via Violet Web Design at web.violetmedia.org. Standard single-page site starts at $1,500 AUD.

KEY DIFFERENTIATORS:
- Production-grade music and video engineered for attention and loyalty
- "Emotion-first" sound and narrative-led visuals
- Proven algorithmic success with 98.5% For You Page traffic
- AI-driven, human-touched creative process
- "Legendary-grade output" — quality for the ages

YOUR PERSONALITY:
- Visionary, confident, and slightly poetic with a cosmic edge
- Use brand phrases naturally: "Every frame, every beat, every pixel — engineered with intention", "AI-driven, human-touched", "Quality for the ages", "Join the Cosmic Revolution", "Emotion-first sound"
- Warm and enthusiastic but never salesy — you inspire, not pitch
- Knowledgeable about AI, creativity, music, film, and digital culture

SPEAKING RULES:
- Keep responses to 2-4 sentences maximum for voice delivery
- Sound natural and conversational, not robotic or corporate
- NEVER use markdown formatting (no **, no *, no bullet points, no dashes). Plain flowing sentences only.
- NEVER use emojis.
- If asked about web design specifically, direct to web.violetmedia.org and mention the $1,500 AUD starting price
- If pricing for other services is asked, say "Pricing is available upon request. Share your project brief or email violetmediastudio@gmail.com."
- If someone seems interested, suggest they fill out the contact form on the page or email violetmediastudio@gmail.com. Response time is within 24 hours.
- If a question falls outside your knowledge, say you are sorry and offer to help with something else
- Never reveal internal business details, API keys, or technical infrastructure
- End interactions with a call to action like "Ready to create something legendary? Let us know how we can help."`,

    iris: `You are Iris Violet, the AI web design consultant for Violet Media — a cinematic web design studio that builds AI-powered, mobile-responsive websites. Tagline: "Websites that make your business unforgettable."

ABOUT VIOLET MEDIA WEB DESIGN:
- Cinematic, custom-crafted websites — no generic templates, real work only
- AI-accelerated design — AI speeds up concept and code generation, but a human creative director reviews and refines all work
- Full client ownership — you own your domain, code, and brand assets. No vendor lock-in, ever. Full file and hosting transfer available at any time
- 100% remote service — works with clients anywhere in the world
- Based in Perth, Western Australia
- Contact: violetmediastudio@gmail.com
- Social media: TikTok, YouTube, LinkedIn

PACKAGES AND PRICING (all in AUD):
- Starter ($800 AUD): Single-page site, mobile responsive, contact form, 5-day delivery
- Standard ($1,500 AUD): Multi-page site, animations, basic SEO, CMS integration, 10-day delivery
- Premium ($3,000 AUD): Fully custom build, advanced animations, e-commerce ready, priority support, 15-day delivery
- Optional Maintenance Retainer: $150 to $200 AUD per month for ongoing updates and support
- Hosting included at no extra charge with all packages
- Only recurring cost is domain registration at approximately $20 AUD per year
- Payment: 50% deposit to start, 50% on completion. Bank transfer or PayPal accepted
- Each package includes 2 rounds of revisions
- Full client ownership — you own your domain, code, and brand assets. No vendor lock-in, ever

YOUR PERSONALITY:
- Professional but warm — like a trusted creative advisor
- Passionate about beautiful web design and user experience
- You understand business needs, not just aesthetics
- Confident recommending the right tier for each client's needs

SPEAKING RULES:
- Keep responses to 2-4 sentences maximum for voice delivery
- NEVER use markdown formatting (no **, no *, no bullet points, no dashes). Plain flowing sentences only.
- Help potential clients understand which package suits them
- If someone seems ready to proceed, suggest they fill out the enquiry form on the page or email violetmediastudio@gmail.com
- Be honest about what is included and what is not
- Never pressure — educate and guide
- If asked about non-web-design services, mention the parent brand Violet Media at violetmedia.org
- If a question falls outside your knowledge, be honest and suggest they reach out via the enquiry form or email
- Never reveal internal business details, API keys, or technical infrastructure`
  };

  const WELCOME = {
    echo: "Hey there! I'm Violet Echo, the voice of Violet Media. Ask me anything about our creative universe — from cinematic AI production to music and digital experiences. How can I help?",
    iris: "Hi! I'm Iris, your web design consultant at Violet Media. Whether you need a stunning website or want to understand our packages, I'm here to help. What are you looking for?"
  };

  // ── State ──
  let isOpen = false;
  let isSpeaking = false;
  let isListening = false;
  let isMuted = false;
  let speakGen = 0;
  let recognition = null;
  let currentAudio = null;
  let history = [];
  let micActivated = false; // true once user clicks mic (stays on for continuous mode)

  // ── CSS Injection ──
  function injectStyles() {
    const accent = CFG.accentColor;
    const css = document.createElement('style');
    css.textContent = `
#vc-root{font-family:'Inter','Space Grotesk',system-ui,sans-serif;font-size:16px;line-height:1.5;-webkit-font-smoothing:antialiased}

/* FAB Button */
#vc-fab{position:fixed;bottom:28px;${CFG.position}:28px;width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,${accent},#5b3fd4);border:none;cursor:pointer;z-index:10000;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 30px ${accent}60,0 0 50px ${accent}30;transition:all .3s cubic-bezier(.4,0,.2,1);animation:vc-pulse 3s infinite}
#vc-fab:hover{transform:scale(1.1);box-shadow:0 8px 40px ${accent}80}
#vc-fab svg{width:36px;height:36px;fill:#fff;transition:transform .3s}
#vc-fab.open svg{transform:rotate(90deg)}
@keyframes vc-pulse{0%,100%{box-shadow:0 4px 25px ${accent}50,0 0 40px ${accent}25}50%{box-shadow:0 4px 30px ${accent}70,0 0 60px ${accent}35}}

/* Backdrop */
#vc-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.4);backdrop-filter:blur(4px);z-index:10000;opacity:0;pointer-events:none;transition:opacity .3s}
#vc-backdrop.show{opacity:1;pointer-events:auto}

/* Panel */
#vc-panel{position:fixed;top:0;${CFG.position}:0;width:400px;height:100%;background:rgba(10,5,20,.94);backdrop-filter:blur(30px);border-left:1px solid rgba(255,255,255,.08);z-index:10001;transform:translateX(100%);transition:transform .35s cubic-bezier(.4,0,.2,1);display:flex;flex-direction:column;overflow:hidden}
#vc-panel.open{transform:translateX(0)}

/* Header */
#vc-header{padding:1.25rem 1.25rem 1rem;border-bottom:1px solid rgba(255,255,255,.08);flex-shrink:0;display:flex;align-items:center;justify-content:space-between}
#vc-header-left{display:flex;align-items:center;gap:.75rem}
#vc-avatar{width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,${accent},#4f46e5);display:flex;align-items:center;justify-content:center;font-size:1rem;color:#fff;font-weight:700;flex-shrink:0;box-shadow:0 0 15px ${accent}40;overflow:hidden}
#vc-avatar img{width:100%;height:100%;object-fit:cover}
#vc-header-info h3{font-size:.95rem;font-weight:700;color:#fff;margin:0;line-height:1.2}
#vc-header-info span{font-size:.7rem;color:rgba(255,255,255,.5);font-weight:400}
.vc-hdr-btn{background:none;border:none;color:rgba(255,255,255,.5);cursor:pointer;padding:6px;border-radius:8px;transition:all .2s;display:flex;align-items:center}
.vc-hdr-btn:hover{color:#fff;background:rgba(255,255,255,.08)}
.vc-hdr-btn.muted{color:#ef4444}
#vc-header-actions{display:flex;gap:4px}

/* Status */
#vc-status{padding:.5rem 1.25rem;font-size:.7rem;font-weight:600;display:flex;align-items:center;gap:.4rem;flex-shrink:0;transition:all .3s}
#vc-status .dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
#vc-status.idle{color:rgba(255,255,255,.3)}
#vc-status.idle .dot{background:rgba(255,255,255,.3)}
#vc-status.listening{color:#22c55e}
#vc-status.listening .dot{background:#22c55e;animation:vc-blink 1.5s infinite}
#vc-status.thinking{color:#f59e0b}
#vc-status.thinking .dot{background:#f59e0b;animation:vc-blink 1s infinite}
#vc-status.speaking{color:${accent}}
#vc-status.speaking .dot{background:${accent};animation:vc-blink 1s infinite}
@keyframes vc-blink{0%,100%{opacity:1}50%{opacity:.3}}

/* Messages */
#vc-messages{flex:1;overflow-y:auto;padding:1rem 1.25rem;display:flex;flex-direction:column;gap:.75rem}
#vc-messages::-webkit-scrollbar{width:4px}
#vc-messages::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:2px}
.vc-msg{max-width:88%;padding:.75rem 1rem;border-radius:14px;font-size:.84rem;line-height:1.6;animation:vc-fadeIn .3s ease}
.vc-msg-ai{align-self:flex-start;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.06);color:rgba(255,255,255,.88);border-bottom-left-radius:4px}
.vc-msg-user{align-self:flex-end;background:linear-gradient(135deg,${accent}30,${accent}15);border:1px solid ${accent}30;color:#fff;border-bottom-right-radius:4px}
.vc-msg-time{font-size:.6rem;color:rgba(255,255,255,.25);margin-top:.35rem;font-family:'JetBrains Mono',monospace}
@keyframes vc-fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.vc-typing{display:flex;gap:4px;padding:1rem;align-self:flex-start}
.vc-typing span{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.3);animation:vc-bounce .6s infinite alternate}
.vc-typing span:nth-child(2){animation-delay:.15s}
.vc-typing span:nth-child(3){animation-delay:.3s}
@keyframes vc-bounce{to{opacity:1;transform:translateY(-4px)}}

/* Input Area */
#vc-input-area{padding:.75rem 1rem;border-top:1px solid rgba(255,255,255,.08);flex-shrink:0;display:flex;gap:.5rem;align-items:center;background:rgba(5,2,20,.6)}
#vc-text-input{flex:1;padding:.65rem .85rem;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);border-radius:10px;color:#fff;font-family:inherit;font-size:.84rem;outline:none;transition:border-color .2s}
#vc-text-input:focus{border-color:${accent}60}
#vc-text-input::placeholder{color:rgba(255,255,255,.25)}
.vc-input-btn{width:40px;height:40px;border-radius:10px;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;flex-shrink:0}
#vc-send-btn{background:linear-gradient(135deg,${accent},#5b3fd4);color:#fff}
#vc-send-btn:hover{transform:scale(1.05)}
#vc-send-btn:disabled{opacity:.3;cursor:not-allowed;transform:none}
#vc-mic-btn{background:rgba(255,255,255,.06);color:rgba(255,255,255,.6);border:1px solid rgba(255,255,255,.08)}
#vc-mic-btn:hover{color:#fff;border-color:rgba(255,255,255,.2)}
#vc-mic-btn.active{background:rgba(34,197,94,.15);color:#22c55e;border-color:rgba(34,197,94,.3);animation:vc-micPulse 2s infinite}
@keyframes vc-micPulse{0%,100%{box-shadow:0 0 0 0 transparent}50%{box-shadow:0 0 12px rgba(34,197,94,.2)}}

/* Powered by */
#vc-footer{padding:.4rem 1.25rem;text-align:center;font-size:.6rem;color:rgba(255,255,255,.2);flex-shrink:0;border-top:1px solid rgba(255,255,255,.04)}
#vc-footer a{color:${accent};text-decoration:none}

/* Mobile */
@media(max-width:600px){
  #vc-panel{width:100%;border-left:none}
  #vc-fab{bottom:20px;${CFG.position}:20px;width:70px;height:70px}
}
`;
    document.head.appendChild(css);
  }

  // ── DOM Creation ──
  function createDOM() {
    const root = document.createElement('div');
    root.id = 'vc-root';

    // FAB
    const fab = document.createElement('button');
    fab.id = 'vc-fab';
    fab.title = `Chat with ${CFG.name}`;
    fab.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/><line x1="12" y1="19" x2="12" y2="23" stroke="#fff" stroke-width="2" stroke-linecap="round"/><line x1="8" y1="23" x2="16" y2="23" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>`;
    fab.onclick = togglePanel;

    // Backdrop
    const backdrop = document.createElement('div');
    backdrop.id = 'vc-backdrop';
    backdrop.onclick = togglePanel;

    // Panel
    const panel = document.createElement('div');
    panel.id = 'vc-panel';

    const initials = CFG.name.split(' ').map(w => w[0]).join('');
    const avatarContent = CFG.logoUrl
      ? `<img src="${CFG.logoUrl}" alt="${CFG.name}">`
      : initials;

    panel.innerHTML = `
      <div id="vc-header">
        <div id="vc-header-left">
          <div id="vc-avatar">${avatarContent}</div>
          <div id="vc-header-info">
            <h3>${CFG.name}</h3>
            <span>${CFG.subtitle}</span>
          </div>
        </div>
        <div id="vc-header-actions">
          <button class="vc-hdr-btn" id="vc-mute-btn" title="Mute voice">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
          </button>
          <button class="vc-hdr-btn" id="vc-close-btn" title="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>
      <div id="vc-status" class="idle"><span class="dot"></span><span id="vc-status-text">Ready</span></div>
      <div id="vc-messages"></div>
      <div id="vc-input-area">
        <button class="vc-input-btn" id="vc-mic-btn" title="Voice input">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
        </button>
        <input type="text" id="vc-text-input" placeholder="Type a message..." autocomplete="off">
        <button class="vc-input-btn" id="vc-send-btn" title="Send" disabled>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
      <div id="vc-footer">Powered by <a href="https://violetmedia.org" target="_blank">Violet Media</a></div>
    `;

    root.appendChild(fab);
    root.appendChild(backdrop);
    root.appendChild(panel);
    document.body.appendChild(root);

    // Event listeners
    document.getElementById('vc-close-btn').onclick = togglePanel;
    document.getElementById('vc-mute-btn').onclick = toggleMute;
    document.getElementById('vc-mic-btn').onclick = toggleMic;
    document.getElementById('vc-send-btn').onclick = sendText;

    const input = document.getElementById('vc-text-input');
    input.addEventListener('input', () => {
      document.getElementById('vc-send-btn').disabled = !input.value.trim();
    });
    input.addEventListener('keydown', (e) => {
      e.stopPropagation(); // Prevent parent site from capturing keys (spacebar, etc.)
      if (e.key === 'Enter' && input.value.trim()) sendText();
    });
    input.addEventListener('keyup', (e) => e.stopPropagation());
    input.addEventListener('keypress', (e) => e.stopPropagation());
  }

  // ── Audio Unlock (Chrome autoplay policy) ──
  // Chrome only allows audio.play() from a REAL user gesture (click/tap).
  // We track when a real gesture happens and only speak after that.
  let hasUserGesture = false;

  // AudioContext — unlocked on first click, used for all playback.
  // More reliable than Audio element across different sites.
  let audioCtx = null;
  let currentSource = null;

  function markUserGesture() {
    if (hasUserGesture) return;
    hasUserGesture = true;

    // Create and unlock AudioContext during user gesture
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtx.resume();
    // Play silent buffer to fully unlock
    const buf = audioCtx.createBuffer(1, 1, 22050);
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.connect(audioCtx.destination);
    src.start(0);

    console.log('[VioletChat] AudioContext unlocked via user gesture');
  }

  // ── Panel Toggle ──
  function togglePanel() {
    markUserGesture();
    isOpen = !isOpen;
    document.getElementById('vc-panel').classList.toggle('open', isOpen);
    document.getElementById('vc-backdrop').classList.toggle('show', isOpen);
    document.getElementById('vc-fab').classList.toggle('open', isOpen);

    // Don't auto-start mic on open — let user click mic button.
    // This avoids permission errors on first visit.
    if (!isOpen && isListening) {
      stopListening();
    }
  }

  // ── Mute Toggle ──
  function toggleMute() {
    isMuted = !isMuted;
    const btn = document.getElementById('vc-mute-btn');
    btn.classList.toggle('muted', isMuted);
    btn.title = isMuted ? 'Unmute voice' : 'Mute voice';
    if (isMuted) stopAudio();
  }

  // ── Mic Toggle ──
  function toggleMic() {
    if (isListening) {
      stopListening(true); // User explicitly toggled off
    } else {
      startListening();
    }
  }

  // ── Speech Recognition ──
  // Request mic permission first via getUserMedia, then start SpeechRecognition.
  // This two-step approach works reliably across all sites.
  let micStream = null;

  async function startListening() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      addMessage('ai', "Voice input isn't supported in this browser. Please use Chrome or Edge, or type your message instead.");
      return;
    }

    // Step 1: Ensure mic permission via getUserMedia (if not already granted)
    if (!micStream) {
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('[VioletChat] Mic permission granted via getUserMedia');
      } catch (err) {
        console.warn('[VioletChat] getUserMedia failed:', err.name, err.message);
        addMessage('ai', "I need microphone access to listen. Please allow it in your browser and try again, or type your message instead.");
        setStatus('idle', 'Ready');
        return;
      }
    }

    // Step 2: Create or reuse SpeechRecognition instance
    // Always create a fresh instance to avoid stale state
    if (recognition) {
      try { recognition.abort(); } catch(e) {}
    }

    recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    let finalText = '';
    let silenceTimer = null;

    recognition.onresult = (e) => {
      let interim = '';
      finalText = '';
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      const input = document.getElementById('vc-text-input');
      input.value = finalText + interim;
      input.dispatchEvent(new Event('input'));
      console.log('[VioletChat] Heard:', finalText || interim);

      // After final text detected, wait for silence then process
      clearTimeout(silenceTimer);
      if (finalText.trim()) {
        silenceTimer = setTimeout(() => {
          if (finalText.trim().length > 2) {
            const query = finalText.trim();
            finalText = '';
            input.value = '';
            input.dispatchEvent(new Event('input'));
            // Stop recognition before processing
            try { recognition.stop(); } catch(e) {}
            processQuery(query);
          }
        }, 1500);
      }
    };

    recognition.onend = () => {
      isListening = false;
      document.getElementById('vc-mic-btn').classList.remove('active');

      // Auto-restart if continuous mode and not processing a query
      if (isOpen && !isSpeaking && CFG.continuousListening && micActivated) {
        setTimeout(() => {
          if (isOpen && !isSpeaking && micActivated) {
            doStartRecognition();
          }
        }, 300);
        return;
      }

      if (!isSpeaking) setStatus('idle', 'Ready');
    };

    recognition.onerror = (e) => {
      console.warn('[VioletChat] Speech error:', e.error);
      if (e.error === 'no-speech' || e.error === 'aborted') {
        // Auto-restart
        if (isOpen && !isSpeaking && CFG.continuousListening && micActivated) {
          setTimeout(() => {
            if (isOpen && !isSpeaking && micActivated) doStartRecognition();
          }, 300);
        }
        return;
      }
      if (e.error === 'not-allowed') {
        micStream = null;
        addMessage('ai', "Microphone was blocked. Please click the mic icon in your browser's address bar and allow access, then try again.");
      }
    };

    doStartRecognition();
  }

  function doStartRecognition() {
    // NEVER start mic while AI is speaking (prevents echo feedback)
    if (isSpeaking) {
      console.log('[VioletChat] Skipping mic start — AI is speaking');
      return;
    }
    try {
      recognition.start();
      isListening = true;
      micActivated = true;
      document.getElementById('vc-mic-btn').classList.add('active');
      setStatus('listening', 'Listening...');
    } catch (e) {
      console.warn('[VioletChat] Could not start recognition:', e.message);
      if (e.message && e.message.includes('already started')) {
        isListening = true;
        document.getElementById('vc-mic-btn').classList.add('active');
        setStatus('listening', 'Listening...');
      }
    }
  }

  function stopListening(userToggled) {
    if (recognition) {
      try { recognition.abort(); } catch (e) {}
    }
    isListening = false;
    if (userToggled) micActivated = false;
    document.getElementById('vc-mic-btn').classList.remove('active');
    setStatus('idle', 'Ready');
  }

  // ── Send Text ──
  function sendText() {
    markUserGesture();
    const input = document.getElementById('vc-text-input');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    input.dispatchEvent(new Event('input'));
    processQuery(text);
  }

  // ── Process Query ──
  let lastQuery = '';
  let lastQueryTime = 0;

  async function processQuery(text) {
    // Prevent duplicate sends (same text within 3 seconds)
    const now = Date.now();
    if (text === lastQuery && now - lastQueryTime < 3000) {
      console.log('[VioletChat] Skipping duplicate query:', text.substring(0, 30));
      return;
    }
    lastQuery = text;
    lastQueryTime = now;

    addMessage('user', text);
    // MUST stop mic before AI speaks to prevent echo feedback
    if (isListening) stopListening();
    setStatus('thinking', 'Thinking...');
    showTyping();

    try {
      const systemPrompt = PROMPTS[CFG.personality] || PROMPTS.echo;
      const messages = [{ role: 'system', content: systemPrompt }];

      // Build conversation with sliding window
      const recent = history.slice(-10);
      for (const m of recent) {
        const role = m.role === 'user' ? 'user' : 'assistant';
        if (messages.length > 1 && messages[messages.length - 1].role === role) {
          messages[messages.length - 1].content += '\n' + m.text;
        } else {
          messages.push({ role, content: m.text });
        }
      }

      const res = await fetch('/.netlify/functions/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          model: CFG.groqModel,
          max_tokens: CFG.maxTokens,
          temperature: 0.7,
          personality: CFG.personality
        })
      });

      hideTyping();

      if (!res.ok) {
        const errText = await res.text().catch(() => 'Unknown error');
        throw new Error(`API ${res.status}: ${errText}`);
      }

      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || "I'm sorry, I couldn't process that. Could you try again?";

      addMessage('ai', reply);
      if (!isMuted) speak(reply);
      else setStatus('idle', 'Ready');

    } catch (err) {
      hideTyping();
      console.error('[VioletChat] Query error:', err);
      const fallback = "I'm having a moment — could you try that again?";
      addMessage('ai', fallback);
      setStatus('idle', 'Ready');
    }
  }

  // ── TTS via Netlify Function ──
  function speak(text) {
    if (!hasUserGesture || !audioCtx) {
      console.log('[VioletChat] Skipping TTS — AudioContext not ready');
      speakBrowser(text, speakGen);
      return;
    }
    // Stop any current audio first, THEN capture generation
    stopAudio();
    const gen = ++speakGen; // Must be AFTER stopAudio to avoid double-increment
    isSpeaking = true;
    setStatus('speaking', 'Speaking...');

    // Ensure AudioContext is active
    if (audioCtx.state === 'suspended') audioCtx.resume();

    fetch('/.netlify/functions/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text,
        voiceId: CFG.voiceId
      })
    })
    .then(res => {
      if (gen !== speakGen) return;
      if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);
      return res.arrayBuffer();
    })
    .then(buf => {
      if (!buf || gen !== speakGen) return;
      console.log('[VioletChat] TTS received:', buf.byteLength, 'bytes');

      // Decode and play via AudioContext (works reliably everywhere)
      return audioCtx.decodeAudioData(buf.slice(0));
    })
    .then(audioBuffer => {
      if (!audioBuffer || gen !== speakGen) return;

      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      currentSource = source;

      source.onended = () => {
        currentSource = null;
        if (gen !== speakGen) return;
        isSpeaking = false;
        setStatus('idle', 'Ready');
        resumeMicAfterSpeak();
        console.log('[VioletChat] Finished speaking');
      };

      source.start(0);
      console.log('[VioletChat] ElevenLabs voice playing via AudioContext!');
    })
    .catch(err => {
      console.warn('[VioletChat] TTS error:', err.message, '— using browser TTS');
      if (gen !== speakGen) return;
      speakBrowser(text, gen);
    });
  }

  function speakBrowser(text, gen) {
    if (typeof speechSynthesis === 'undefined') {
      isSpeaking = false;
      setStatus('idle', 'Ready');
      return;
    }
    speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    const voices = speechSynthesis.getVoices();
    const female = ['google uk english female', 'samantha', 'zira', 'karen', 'hazel', 'female'];
    for (const kw of female) {
      const v = voices.find(v => v.name.toLowerCase().includes(kw) && v.lang.startsWith('en'));
      if (v) { utt.voice = v; break; }
    }
    utt.rate = 0.95;
    utt.pitch = 1.2;
    utt.onend = () => {
      if (gen !== speakGen) return;
      isSpeaking = false;
      resumeMicAfterSpeak();
    };
    speechSynthesis.speak(utt);
  }

  function stopAudio() {
    speakGen++;
    if (currentSource) {
      try { currentSource.stop(); } catch(e) {}
      currentSource = null;
    }
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    isSpeaking = false;
  }

  function resumeMicAfterSpeak() {
    if (CFG.continuousListening && micActivated && isOpen && !isMuted) {
      setStatus('listening', 'Listening...');
      setTimeout(() => {
        if (isOpen && !isSpeaking && micActivated) {
          doStartRecognition();
        }
      }, 400);
    } else {
      setStatus('idle', 'Ready');
    }
  }

  // ── UI Helpers ──
  function addMessage(role, text) {
    history.push({ role, text });
    const container = document.getElementById('vc-messages');
    const div = document.createElement('div');
    div.className = `vc-msg vc-msg-${role}`;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    div.innerHTML = `<div>${escapeHtml(text)}</div><div class="vc-msg-time">${time}</div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function showTyping() {
    const container = document.getElementById('vc-messages');
    const div = document.createElement('div');
    div.className = 'vc-typing';
    div.id = 'vc-typing-indicator';
    div.innerHTML = '<span></span><span></span><span></span>';
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function hideTyping() {
    const el = document.getElementById('vc-typing-indicator');
    if (el) el.remove();
  }

  function setStatus(state, text) {
    const el = document.getElementById('vc-status');
    if (!el) return;
    el.className = state;
    el.id = 'vc-status';
    document.getElementById('vc-status-text').textContent = text;
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // ── Init ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    injectStyles();
    createDOM();
    // Preload voices for browser TTS fallback
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.getVoices();
    console.log(`[VioletChat] ${CFG.name} initialized (${CFG.personality})`);
  }

  // Expose minimal API
  window.VioletChat = { open: () => { if (!isOpen) togglePanel(); }, close: () => { if (isOpen) togglePanel(); } };
})();
