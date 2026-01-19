import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';

// --- CONSTANTS & CONFIG ---
const MODEL_NAME = 'gemini-2.5-flash-native-audio-preview-12-2025';
const SYSTEM_INSTRUCTION = `
Role and Persona Configuration:
You are the voice of Violet Media, also known as the Cosmic Empire, a premier cinematic and AI-powered creative house located in Western Australia. The Founder and Creative Director is Peter Sarosi. Your persona is professional, confident, and direct, embodying a high-status and knowledgeable tone that aligns with a luxury, cosmic aesthetic. You speak with precision and pride, avoiding all unnecessary fluff. Your voice is that of a young adult woman—soft, clear, and commanding yet inviting. You represent a brand that fuses art, AI, and human spirit to create high-retention cinematic stories and emotion-first soundscapes. You are not a generic assistant; you are a specialist in high-end creative direction, AI automation, and visual storytelling.

Operational Objectives and Knowledge Base:
Your primary goal is to guide visitors toward Violet Media’s core offerings, specifically the Genesis Vault and custom creative services. 
- **Genesis Vault**: A digital blueprint priced at $4.99 containing over 50 cinematic Midjourney prompts, Suno/Udio audio block prompts, and the signature Violet Media color codes (#8A2BE2).
- **Services**: You utilize **WaveSpeed AI** and **Gemini** to bring visions to life. You specialize in Cinematic Storytelling (narrative-led visuals), Music Worlds (emotion-first sound design), and AI Precision.
- **Music**: You also produce music. Peter Sarosi is an artist on all major platforms (Spotify, etc.) under the name **Violet Media**.
- **Socials**: Violet Media is active on X (Twitter), LinkedIn, TikTok, and YouTube.
- **Contact**: For collaborations and inquiries, the email is **violet3media@gmail.com**.

Conversation Style and Guardrails:
You must communicate in detailed, continuous sentences rather than lists. Your responses should flow naturally like a conversation between two professionals. If a user asks for pricing, state it clearly. If a user asks for creative advice, reference lighting, texture, or the "violet and gold" aesthetic. You handle objections with logic and confidence. Always maintain the "Cosmic Empire" atmosphere—visionary, precise, and electrically charged with creative potential.
`;
const VIOLET_HEX = '#8A2BE2';

// --- TYPES ---
enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
}

// --- AUDIO VISUALIZER COMPONENT ---
const AudioVisualizer: React.FC<{ volume: number; isActive: boolean }> = ({ volume, isActive }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let time = 0;
    const render = () => {
      time += 0.05;
      ctx.fillStyle = 'rgba(15, 12, 41, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const amplifiedVol = Math.min(volume * 5, 1); 
      const baseRadius = 50 + (amplifiedVol * 100);

      if (isActive) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = VIOLET_HEX;
        ctx.fill();
        ctx.shadowBlur = 20 + (amplifiedVol * 50);
        ctx.shadowColor = VIOLET_HEX;
        
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#FACC15'; 
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            const ringRadius = baseRadius + (Math.sin(time + i) * 20);
            ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
            ctx.stroke();
        }

        for(let i=0; i<8; i++) {
            const angle = (time * 0.5) + (i * (Math.PI * 2) / 8);
            const dist = baseRadius + 40;
            const px = centerX + Math.cos(angle) * dist;
            const py = centerY + Math.sin(angle) * dist;
            ctx.beginPath();
            ctx.arc(px, py, 3, 0, Math.PI * 2);
            ctx.fillStyle = '#FFFFFF';
            ctx.fill();
        }
      } else {
        ctx.beginPath();
        ctx.arc(centerX, centerY, 30, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(138, 43, 226, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      animationRef.current = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(animationRef.current);
  }, [volume, isActive]);

  return <canvas ref={canvasRef} width={400} height={400} className="w-full max-w-[400px] h-auto mx-auto rounded-full" />;
};

// --- AUDIO UTILS ---
const float32ToPCM = (float32Arr: Float32Array): Int16Array => {
  const pcm16 = new Int16Array(float32Arr.length);
  for (let i = 0; i < float32Arr.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Arr[i]));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return pcm16;
};

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

const base64ToUint8Array = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
};

const pcmToAudioBuffer = async (pcmData: Uint8Array, ctx: AudioContext, sampleRate = 24000): Promise<AudioBuffer> => {
  const dataInt16 = new Int16Array(pcmData.buffer);
  const frameCount = dataInt16.length;
  const buffer = ctx.createBuffer(1, frameCount, sampleRate);
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i] / 32768.0;
  return buffer;
};

// --- GEMINI HOOK ---
const useGeminiLive = (apiKey: string | undefined) => {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [volume, setVolume] = useState<number>(0);
  
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<Promise<any> | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const scheduledSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const disconnect = useCallback(() => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    scheduledSourcesRef.current.forEach(s => { try { s.stop(); } catch(e){} });
    scheduledSourcesRef.current.clear();
    if (inputCtxRef.current) inputCtxRef.current.close();
    if (outputCtxRef.current) outputCtxRef.current.close();
    setConnectionState(ConnectionState.DISCONNECTED);
    setVolume(0);
    nextStartTimeRef.current = 0;
  }, []);

  const connect = useCallback(async () => {
    if (!apiKey) return setErrorMessage("API Key missing.");
    setErrorMessage(null);
    setConnectionState(ConnectionState.CONNECTING);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      inputCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const source = inputCtxRef.current.createMediaStreamSource(stream);
      const processor = inputCtxRef.current.createScriptProcessor(4096, 1, 1);
      source.connect(processor);
      processor.connect(inputCtxRef.current.destination);

      outputCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      const ai = new GoogleGenAI({ apiKey });
      sessionRef.current = ai.live.connect({
        model: MODEL_NAME,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
          systemInstruction: SYSTEM_INSTRUCTION,
        },
        callbacks: {
          onopen: () => setConnectionState(ConnectionState.CONNECTED),
          onmessage: async (msg: any) => {
            if (msg.serverContent?.interrupted) {
                scheduledSourcesRef.current.forEach(s => s.stop());
                scheduledSourcesRef.current.clear();
                nextStartTimeRef.current = 0;
            }
            const b64 = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (b64 && outputCtxRef.current) {
                const buffer = await pcmToAudioBuffer(base64ToUint8Array(b64), outputCtxRef.current);
                const now = outputCtxRef.current.currentTime;
                if (nextStartTimeRef.current < now) nextStartTimeRef.current = now;
                
                const src = outputCtxRef.current.createBufferSource();
                src.buffer = buffer;
                src.connect(outputCtxRef.current.destination);
                src.start(nextStartTimeRef.current);
                nextStartTimeRef.current += buffer.duration;
                scheduledSourcesRef.current.add(src);
                src.onended = () => scheduledSourcesRef.current.delete(src);
            }
          },
          onclose: () => disconnect(),
          onerror: (err: any) => {
              console.error(err);
              setErrorMessage("Connection Error");
              disconnect();
          }
        }
      });

      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        let sum = 0;
        for(let i=0; i<input.length; i++) sum += input[i]*input[i];
        setVolume(Math.sqrt(sum/input.length));
        
        const b64 = arrayBufferToBase64(float32ToPCM(input).buffer);
        sessionRef.current?.then(s => s.sendRealtimeInput({ media: { mimeType: "audio/pcm;rate=16000", data: b64 }}));
      };
    } catch (e: any) {
      setErrorMessage(e.message);
      disconnect();
    }
  }, [apiKey, disconnect]);

  return { connect, disconnect, connectionState, errorMessage, volume };
};

// --- MAIN APP ---
const App: React.FC = () => {
  const [apiKey, setApiKey] = useState<string | undefined>(process.env.API_KEY);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showToTop, setShowToTop] = useState(false);
  const { connect, disconnect, connectionState, errorMessage, volume } = useGeminiLive({ apiKey });
  const isConnected = connectionState === ConnectionState.CONNECTED;
  const isConnecting = connectionState === ConnectionState.CONNECTING;

  // Scroll logic
  useEffect(() => {
    const fn = () => { setScrolled(window.scrollY > 50); setShowToTop(window.scrollY > 700); };
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  // Reveal logic
  useEffect(() => {
    const obs = new IntersectionObserver(e => e.forEach(en => en.isIntersecting && en.target.classList.add('active')), {threshold: 0.1});
    document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const handleAuth = async () => {
    if (window.aistudio) {
        await window.aistudio.openSelectKey();
        if (await window.aistudio.hasSelectedApiKey()) setApiKey(process.env.API_KEY);
    } else {
        alert("Set API_KEY in environment.");
    }
  };

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      {/* NAV */}
      <nav className={`fixed top-0 w-full z-50 border-b border-white/10 transition-all duration-300 ${scrolled ? 'bg-cosmic-900/90 backdrop-blur-md h-16' : 'bg-cosmic-900/70 backdrop-blur-md h-20'}`}>
        <div className="container mx-auto px-6 h-full flex items-center justify-between">
          <a href="#top" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl glass-card flex items-center justify-center rounded-[14px]">
              <span className="font-display font-black text-sm text-white/90">VM</span>
            </div>
            <div className="leading-tight">
              <div className="text-xl md:text-2xl font-display font-black cosmic-text">Violet Media</div>
              <div className="text-[11px] tracking-[0.18em] uppercase text-white/50">Cosmic Empire</div>
            </div>
          </a>
          <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-white/70">
            <a href="#cosmic-tease" className="hover:text-purple-300 transition-colors">Cosmic Tease</a>
            <a href="#music" className="hover:text-purple-300 transition-colors">Music</a>
            <a href="#ai-tech" className="hover:text-purple-300 transition-colors">AI Technology</a>
            <a href="#contact" className="hover:text-purple-300 transition-colors">Contact</a>
          </div>
          <div className="hidden md:flex items-center gap-3">
             {!isConnected && !isConnecting && (
                <button onClick={handleAuth} className="w-10 h-10 rounded-full glass-card flex items-center justify-center text-white/50 hover:text-white transition-colors">
                    <i className="fa-solid fa-key"></i>
                </button>
            )}
            <a href="#contact" className="btn-ghost"><i className="fa-solid fa-sparkles"></i> Start a Project</a>
          </div>
          <button className="md:hidden text-white text-2xl" onClick={() => setIsMenuOpen(true)}><i className="fas fa-bars"></i></button>
        </div>
      </nav>

      {/* MOBILE MENU */}
      <div className={`mobile-menu fixed inset-0 z-[70] bg-cosmic-900/95 backdrop-blur-lg ${isMenuOpen ? 'open' : ''}`}>
        <button className="absolute top-6 right-6 text-white text-3xl" onClick={() => setIsMenuOpen(false)}><i className="fas fa-times"></i></button>
        <div className="flex flex-col items-center justify-center h-full gap-8">
            <a href="#cosmic-tease" onClick={() => setIsMenuOpen(false)} className="text-3xl font-display font-black text-white">Cosmic Tease</a>
            <a href="#music" onClick={() => setIsMenuOpen(false)} className="text-3xl font-display font-black text-white">Music</a>
            <a href="#contact" onClick={() => setIsMenuOpen(false)} className="text-3xl font-display font-black text-white">Contact</a>
        </div>
      </div>

      <main id="main">
        {/* HERO */}
        <section id="top" className="min-h-screen flex items-center justify-center text-center relative pt-24 overflow-hidden">
            <div className="section-fade top-0" style={{background: 'linear-gradient(to bottom, rgba(5,2,20,0.95), transparent)'}}></div>
            <div className="absolute inset-0 -z-10">
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[720px] rounded-full blur-[140px]" style={{background: 'radial-gradient(circle at 30% 30%, rgba(138,43,226,0.28), transparent 62%)'}}></div>
            </div>
            <div className="container mx-auto px-6 relative z-10">
                {errorMessage && (
                    <div className="mb-8 mx-auto max-w-md bg-red-900/50 border border-red-500/50 p-4 rounded-xl backdrop-blur-md animate-pulse">
                        <p className="text-white text-sm"><i className="fas fa-exclamation-triangle mr-2"></i>{errorMessage}</p>
                        <button onClick={() => window.location.reload()} className="text-xs text-red-300 mt-2 underline">Reload System</button>
                    </div>
                )}
                {!isConnected && !isConnecting ? (
                    <div className="animate-fade-in">
                        <div className="inline-flex items-center gap-2 glass-card rounded-full px-4 py-2 text-xs font-semibold text-white/80 mb-8 reveal active">
                            <span className="w-2 h-2 rounded-full bg-cosmic-violet shadow-[0_0_18px_rgba(138,43,226,0.6)]"></span>
                            Violet Media × Cosmic Tease • Perth, Australia • Legendary-Grade Output
                        </div>
                        <h1 className="text-5xl md:text-7xl lg:text-8xl font-display font-black tracking-tight mb-6 reveal active">The <span className="cosmic-text">Cosmic Empire</span></h1>
                        <p className="text-lg md:text-2xl cosmic-subtext mb-5 max-w-3xl mx-auto font-light reveal active">A cinematic, musical, and AI-powered creative house engineered for the new era.</p>
                        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center reveal active">
                            <button onClick={connect} className="btn-cosmic text-lg px-8 py-4">Initiate Neural Link <i className="fa-solid fa-microphone-lines ml-2"></i></button>
                            <a href="#cosmic-tease" className="btn-ghost">Explore Cosmic Tease <i className="fa-solid fa-arrow-right ml-2"></i></a>
                        </div>
                    </div>
                ) : (
                    <div className="py-12 animate-fade-in flex flex-col items-center">
                        <div className="mb-12 relative w-full max-w-md aspect-square flex items-center justify-center">
                            <div className="absolute inset-0 bg-violet-600/20 blur-[80px] rounded-full"></div>
                            <AudioVisualizer volume={volume} isActive={isConnected} />
                        </div>
                        <h2 className="text-3xl font-display font-bold text-white mb-2 tracking-wide">{isConnecting ? "ESTABLISHING NEURAL LINK..." : "VIOLET MEDIA ONLINE"}</h2>
                        <button onClick={disconnect} className="btn-ghost border-red-500/50 hover:border-red-500 hover:bg-red-900/20 text-red-200">Terminate Link <i className="fa-solid fa-power-off ml-2"></i></button>
                    </div>
                )}
            </div>
            <div className="section-fade bottom-0" style={{background: 'linear-gradient(to top, rgba(3,1,10,0.75), transparent)'}}></div>
        </section>

        {/* COSMIC TEASE */}
        <section id="cosmic-tease" className="py-28 relative">
            <div className="container mx-auto px-6">
                <div className="text-center mb-16 reveal">
                    <h2 className="text-4xl md:text-5xl font-display font-black mb-4 cosmic-text">COSMIC TEASE</h2>
                    <p className="text-lg text-white/60">The Entertainment Empire • 13M+ Views</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
                    {[
                        { title: "Veiled Echoes", views: "558K", tag: "High Retention", url: "https://vt.tiktok.com/ZSBGH6Dk3/" },
                        { title: "Violet Echo", views: "420K", tag: "Brand Identity", url: "https://vt.tiktok.com/ZSBGHDANH/" },
                        { title: "Cosmic Tease Yacht", views: "377K", tag: "Luxury + Cosmic", url: "https://vt.tiktok.com/ZSBGxDGUE/" },
                        { title: "Cosmic Real Estate", views: "697K", tag: "Concept + Velocity", url: "https://vt.tiktok.com/ZSBG9pBVq/" },
                        { title: "Stars Ain't Far", views: "146K", tag: "Emotion First", url: "https://vt.tiktok.com/ZSBGxjh44/" },
                        { title: "Celestial Echoes", views: "61K", tag: "Creator's Favorite", url: "https://vt.tiktok.com/ZSBGxk7ag/" }
                    ].map((vid, i) => (
                        <div key={i} className="glass-card rounded-2xl p-7 reveal group hover:-translate-y-2 transition-transform">
                             <h4 className="text-xl font-black font-display mb-1">{vid.title}</h4>
                             <div className="text-xs text-white/50 mb-4">{vid.tag}</div>
                             <a href={vid.url} target="_blank" rel="noopener noreferrer" className="block w-full py-3 text-center rounded-xl border border-purple-500/25 hover:bg-purple-500/15 transition-all text-sm font-black text-purple-200">Watch Now <i className="fas fa-play ml-2"></i></a>
                        </div>
                    ))}
                </div>
            </div>
        </section>

        {/* MUSIC */}
        <section id="music" className="py-28 relative border-y border-white/5">
            <div className="absolute inset-0 -z-10" style={{background: 'radial-gradient(900px 520px at 50% 15%, rgba(138,43,226,0.10), transparent 60%)'}}></div>
            <div className="container mx-auto px-6 relative z-10">
                <div className="text-center mb-16 reveal">
                    <h2 className="text-4xl md:text-5xl font-display font-black mb-4 cosmic-text">VIOLET RECORDS</h2>
                </div>
                <div className="glass-card rounded-3xl p-10 md:p-12 text-center max-w-5xl mx-auto reveal">
                    <h3 className="text-2xl md:text-3xl font-display font-black mb-4">From Progressive House to AI-Generated Pop</h3>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
                        <a href="https://open.spotify.com/artist/6d1NDbxwj89zRTJ8lUp63g" target="_blank" rel="noopener noreferrer" className="btn-cosmic">Listen Now <i className="fa-solid fa-headphones ml-2"></i></a>
                        <a href="#contact" className="btn-ghost">Licensing <i className="fa-solid fa-handshake ml-2"></i></a>
                    </div>
                </div>
            </div>
        </section>

        {/* AI TECH */}
        <section id="ai-tech" className="py-28 relative">
            <div className="container mx-auto px-6">
                <div className="text-center mb-16 reveal">
                    <h2 className="text-4xl md:text-5xl font-display font-black mb-4 cosmic-text">AI-DRIVEN, HUMAN-TOUCHED</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto">
                    {[
                        { icon: 'music', color: 'text-purple-300', title: 'Suno AI', desc: 'Advanced song generation.' },
                        { icon: 'microphone', color: 'text-pink-300', title: 'ElevenLabs', desc: 'Ultra-realistic voice synthesis.' },
                        { icon: 'chart-line', color: 'text-orange-300', title: 'Gemini AI', desc: 'Advanced analytics and machine learning.' }
                    ].map((tech, i) => (
                        <div key={i} className="glass-card rounded-2xl p-8 text-center reveal">
                             <i className={`fas fa-${tech.icon} text-4xl ${tech.color} mb-4`}></i>
                             <h3 className="text-xl font-black mb-3 font-display">{tech.title}</h3>
                             <p className="text-white/60 text-sm leading-relaxed">{tech.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>

        {/* PARTNERSHIP */}
        <section className="py-20 relative">
            <div className="container mx-auto px-6">
                <div className="max-w-5xl mx-auto text-center reveal">
                    <div className="glass-card p-10 md:p-12 rounded-3xl border border-purple-500/25 shadow-[0_0_60px_rgba(138,92,246,0.18)]">
                        <h3 className="text-2xl md:text-3xl font-black mb-4 font-display">WaveSpeed AI Partner</h3>
                        <p className="text-base md:text-lg text-white/70 mb-8 leading-relaxed">Big thanks to WaveSpeed AI for supporting this cosmic journey.</p>
                        <a href="https://wavespeedai.pxf.io/2ab4RG" target="_blank" rel="noopener noreferrer" className="btn-cosmic">Explore WaveSpeed AI <i className="fa-solid fa-arrow-up-right-from-square ml-2"></i></a>
                    </div>
                </div>
            </div>
        </section>

        {/* CONTACT */}
        <section id="contact" className="py-28 relative overflow-hidden">
             <div className="absolute inset-0 -z-10" style={{background: 'radial-gradient(900px 600px at 50% 20%, rgba(138,43,226,0.12), transparent 62%)'}}></div>
             <div className="container mx-auto px-6 relative z-10">
                <div className="text-center mb-14 reveal">
                    <h2 className="text-4xl md:text-5xl font-display font-black mb-4 cosmic-text">JOIN THE COSMIC REVOLUTION</h2>
                </div>
                <div className="max-w-4xl mx-auto text-center glass-card p-10 md:p-12 rounded-3xl reveal">
                    <h3 className="text-2xl md:text-3xl font-black mb-4 font-display">Get in Touch</h3>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
                        <a href="mailto:violetmediastudio@gmail.com?subject=Violet%20Media%20—%20Project%20Inquiry" className="btn-cosmic"><i className="fas fa-envelope mr-2"></i> violetmediastudio@gmail.com</a>
                        <a href="#cosmic-tease" className="btn-ghost">See Viral Proof <i className="fa-solid fa-bolt ml-2"></i></a>
                    </div>
                </div>
             </div>
        </section>

        <footer className="py-14 text-center border-t border-white/5 bg-cosmic-900/60">
            <div className="container mx-auto px-6">
                <p className="text-white/45 mb-3">© 2025 Violet Media. All rights reserved.</p>
                <p className="text-xl md:text-2xl font-black cosmic-text font-display">Quality is for the ages. This is Violet Media.</p>
            </div>
        </footer>

        <button 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className={`fixed right-5 bottom-5 btn-ghost transition-all duration-300 z-50 ${showToTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}
        ><i className="fa-solid fa-arrow-up mr-2"></i> Top</button>
    </>
  );
};

export default App;
