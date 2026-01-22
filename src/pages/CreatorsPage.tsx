import React, { useEffect, useRef, useState } from 'react';
import { 
  ShieldCheckIcon, 
  GlobeAltIcon,
  MegaphoneIcon,
  ShoppingBagIcon,
  TicketIcon,
  UserGroupIcon,
  VideoCameraIcon,
  SparklesIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import SEOHelmet from '../components/SEOHelmet';

// Creator bio URLs for live embeds
const creatorBios = [
  { name: 'Chris Ripa', handle: 'chrisripa', url: 'https://shoutout.fans/chrisripa' },
  { name: 'Greg On Fire', handle: 'gregonfire', url: 'https://shoutout.fans/gregonfire' },
  { name: 'Shawn Farash', handle: 'shawnfarash', url: 'https://shoutout.fans/shawnfarash' },
  { name: 'Melonie Mac', handle: 'meloniemac', url: 'https://shoutout.fans/meloniemac' },
  { name: 'Nick Di Paolo', handle: 'nickdipaolo', url: 'https://shoutout.fans/nickdipaolo' },
  { name: 'Lydia Shaffer', handle: 'lydiashaffer', url: 'https://shoutout.fans/lydiashaffer' },
];

export default function CreatorsPage() {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    document.title = 'Shout.bio - The Free-Speech Bio Link for Creators | ShoutOut';
  }, []);

  // Mouse tracking for gradient effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Infinite scroll animation
  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel) return;

    let animationId: number;
    let position = 0;
    const speed = 0.4;

    const animate = () => {
      position -= speed;
      const cardWidth = 300 + 32; // card width + gap
      if (Math.abs(position) >= cardWidth * creatorBios.length) {
        position = 0;
      }
      carousel.style.transform = `translateX(${position}px)`;
      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);

    const handleMouseEnter = () => cancelAnimationFrame(animationId);
    const handleMouseLeave = () => { animationId = requestAnimationFrame(animate); };
    
    carousel.addEventListener('mouseenter', handleMouseEnter);
    carousel.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      cancelAnimationFrame(animationId);
      carousel.removeEventListener('mouseenter', handleMouseEnter);
      carousel.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  const services = [
    { icon: ShoppingBagIcon, title: 'Sell merch', comingSoon: true },
    { icon: TicketIcon, title: 'Sell tickets', comingSoon: true },
    { icon: UserGroupIcon, title: 'Sell social collaborations', comingSoon: false },
    { icon: VideoCameraIcon, title: 'Sell ShoutOut orders', comingSoon: false },
  ];

  return (
    <>
      <SEOHelmet 
        title="Shout.bio - The Free-Speech Bio Link for Creators"
        description="The only free-speech, commerce-ready bio link that helps you secure your uncancellable audience. Convert followers into fans you actually own."
        keywords="bio link, link in bio, creator economy, free speech, uncancellable, audience building, monetization"
        url="https://shoutout.us/creators"
      />
      
      <div className="min-h-screen overflow-hidden relative">
        {/* Dynamic cursor gradient */}
        <div 
          className="fixed inset-0 pointer-events-none z-0 opacity-30"
          style={{
            background: `radial-gradient(800px circle at ${mousePos.x}px ${mousePos.y}px, rgba(16, 185, 129, 0.15), transparent 40%)`
          }}
        />

        {/* Hero Section */}
        <section className="relative pt-6 pb-8 sm:pt-10 sm:pb-12">
          {/* Animated gradient mesh */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-0 -left-40 w-[500px] h-[500px] bg-gradient-to-r from-emerald-600/30 to-teal-600/20 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute top-40 -right-40 w-[600px] h-[600px] bg-gradient-to-r from-cyan-600/20 to-blue-600/15 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
            <div className="absolute -bottom-40 left-1/3 w-[500px] h-[500px] bg-gradient-to-r from-purple-600/15 to-pink-600/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
          </div>
          
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Main headline */}
            <div className="text-center max-w-5xl mx-auto mb-8">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-white mb-8 leading-[1.1] tracking-tight">
                The only{' '}
                <span className="relative inline-block">
                  <span className="relative z-10 text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
                    free-speech
                  </span>
                </span>
                , commerce-ready bio link that helps you secure your{' '}
                <span className="relative inline-block">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-orange-400 to-red-400">
                    uncancellable
                  </span>
                  <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 8" fill="none">
                    <path d="M2 6C50 2 150 2 198 6" stroke="url(#underline-gradient)" strokeWidth="3" strokeLinecap="round"/>
                    <defs>
                      <linearGradient id="underline-gradient" x1="0" y1="0" x2="200" y2="0">
                        <stop stopColor="#fbbf24"/>
                        <stop offset="0.5" stopColor="#f97316"/>
                        <stop offset="1" stopColor="#ef4444"/>
                      </linearGradient>
                    </defs>
                  </svg>
                </span>
                {' '}audience.
              </h1>
              
              <p className="text-xl sm:text-2xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
                Our mission at ShoutOut is to empower free-speech creators through richer experiences for their audience.
              </p>
            </div>

            {/* Badge section */}
            <div className="flex flex-wrap justify-center gap-3 sm:gap-4 mb-12">
              {[
                { icon: ShieldCheckIcon, label: 'Security', color: 'emerald' },
                { icon: SparklesIcon, label: 'Simplicity', color: 'cyan' },
                { icon: GlobeAltIcon, label: 'Sovereignty', color: 'purple' },
              ].map((badge, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 px-5 py-3 rounded-full backdrop-blur-xl border transition-all duration-300 hover:scale-105
                    ${badge.color === 'emerald' ? 'bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20' : ''}
                    ${badge.color === 'cyan' ? 'bg-cyan-500/10 border-cyan-500/30 hover:bg-cyan-500/20' : ''}
                    ${badge.color === 'purple' ? 'bg-purple-500/10 border-purple-500/30 hover:bg-purple-500/20' : ''}
                  `}
                >
                  <badge.icon className={`w-5 h-5 ${
                    badge.color === 'emerald' ? 'text-emerald-400' :
                    badge.color === 'cyan' ? 'text-cyan-400' : 'text-purple-400'
                  }`} />
                  <span className="text-white font-semibold">{badge.label}</span>
                </div>
              ))}
            </div>

            {/* Info box */}
            <div className="max-w-3xl mx-auto mb-8">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/50 via-cyan-500/50 to-purple-500/50 rounded-2xl blur-lg opacity-40 group-hover:opacity-60 transition duration-500" />
                <div className="relative glass rounded-2xl p-6 sm:p-8 border border-white/20 bg-black/30">
                  <p className="text-lg sm:text-xl text-gray-200 leading-relaxed">
                    Your link in bio is one of the most powerful tools you have as a creator. <span className="text-white font-semibold">Use it wisely.</span>
                  </p>
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <p className="text-emerald-300 font-semibold text-lg flex items-center gap-2">
                      <CheckCircleIcon className="w-6 h-6" />
                      Best part? We already built it for you.
                    </p>
                    <p className="text-gray-300 mt-2">
                      If you are a creator on ShoutOut, you have <span className="text-cyan-400 font-bold">our bio link</span> setup and ready to monetize. No additional setup required.
                    </p>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Creator bio carousel - Full width */}
          <div className="relative mb-8 w-screen left-1/2 -translate-x-1/2">
            {/* Soft edge fades */}
            <div className="absolute inset-y-0 left-0 w-24 sm:w-40 bg-gradient-to-r from-[#111827] to-transparent z-10 pointer-events-none" />
            <div className="absolute inset-y-0 right-0 w-24 sm:w-40 bg-gradient-to-l from-[#111827] to-transparent z-10 pointer-events-none" />
            
            <div className="overflow-x-clip overflow-y-visible py-4 pb-16 px-4">
              <div 
                ref={carouselRef}
                className="flex gap-6"
                style={{ width: 'max-content' }}
              >
                {/* Live bio embeds for seamless loop */}
                {[...creatorBios, ...creatorBios, ...creatorBios, ...creatorBios].map((creator, index) => (
                  <div
                    key={index}
                    className="w-[280px] sm:w-[320px] flex-shrink-0 group"
                  >
                    <div className="relative rounded-[2rem] overflow-hidden border border-white/10 transform transition-all duration-500 group-hover:scale-[1.02] group-hover:-translate-y-2 bg-[#1a1a2e]" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
                      {/* Live iframe embed */}
                      <div className="relative w-full h-[500px] sm:h-[580px]">
                        <iframe
                          src={creator.url}
                          title={`${creator.name}'s bio`}
                          className="w-full h-full border-0 rounded-[2rem]"
                          loading="lazy"
                          scrolling="no"
                        />
                        {/* Click-blocking overlay */}
                        <div className="absolute inset-0 cursor-default" />
                      </div>
                      {/* Hover info overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-[2rem]" />
                      <div className="absolute bottom-0 left-0 right-0 p-6 text-white translate-y-full group-hover:translate-y-0 transition-transform duration-300 pointer-events-none">
                        <p className="font-bold text-xl">{creator.name}</p>
                        <p className="text-emerald-400 font-mono text-sm">shoutout.fans/{creator.handle}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Own Your Audience Section */}
        <section className="py-12 sm:py-16 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-900/10 to-transparent" />
          
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              {/* Left: Content */}
              <div>
                <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
                  Own your{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-purple-400 to-fuchsia-400">
                    audience.
                  </span>
                </h2>

                {/* Stats row */}
                <div className="grid grid-cols-2 gap-3 mb-8">
                  <div className="glass rounded-xl p-4 border border-red-500/20 text-center bg-gradient-to-br from-red-500/5 to-transparent">
                    <div className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-orange-400">
                      ~2.6%
                    </div>
                    <p className="text-gray-400 text-xs sm:text-sm leading-tight">of followers see your posts on social media.</p>
                  </div>
                  <div className="glass rounded-xl p-4 border border-emerald-500/40 text-center bg-gradient-to-br from-emerald-500/10 to-teal-500/5">
                    <div className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">
                      ~6%
                    </div>
                    <p className="text-emerald-300 text-xs sm:text-sm leading-tight">of views become reachable fans with our bio link</p>
                  </div>
                </div>
                
                <div className="space-y-6 text-lg">
                  <div className="flex items-start gap-4 p-4 rounded-xl bg-red-500/5 border border-red-500/20">
                    <div className="flex-shrink-0 w-3 h-3 rounded-full bg-red-500 mt-2 animate-pulse" />
                    <p className="text-gray-300">
                      Social platforms only show your posts to <span className="text-white font-bold">~2.6% of your followers</span>. Your hard earned audience is being stolen.
                    </p>
                  </div>
                  
                  <div className="flex items-start gap-4 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                    <div className="flex-shrink-0 w-3 h-3 rounded-full bg-emerald-500 mt-2" />
                    <p className="text-gray-300">
                      <span className="text-emerald-400 font-bold">Our bio link</span> turns followers into an owned audience—fast.
                    </p>
                  </div>
                  
                  <div className="flex items-start gap-4 p-4 rounded-xl bg-purple-500/5 border border-purple-500/20">
                    <div className="flex-shrink-0 w-3 h-3 rounded-full bg-purple-500 mt-2" />
                    <p className="text-gray-300">
                      Creators using shout.bio convert <span className="text-white font-bold">~6% of profile views</span> into instantly reachable fans, all on auto pilot.
                    </p>
                  </div>
                  
                  <div className="flex items-start gap-4 p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
                    <div className="flex-shrink-0 w-3 h-3 rounded-full bg-blue-500 mt-2" />
                    <p className="text-gray-300">
                      Send updates directly from your dashboard—without clunky tools like Mailchimp.
                    </p>
                  </div>
                </div>

                {/* Special badge */}
                <div className="mt-6 relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/30 to-orange-500/30 rounded-2xl blur-lg opacity-50 group-hover:opacity-70 transition" />
                  <div className="relative flex items-center gap-4 px-6 py-5 rounded-2xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center flex-shrink-0">
                      <MegaphoneIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-amber-300 font-bold text-lg">We build your fan list FOR you!</p>
                      <p className="text-amber-200/70">Driving users on ShoutOut to subscribe to your list.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Visual examples - overlapping layout */}
              <div className="relative h-[400px] sm:h-[500px]">
                {/* Send Update - Background/larger image */}
                <div className="absolute bottom-0 right-0 w-[85%] rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
                  <img 
                    src="/creatorbios/sendupdate.png" 
                    alt="Send update - How creators reach their audience"
                    className="w-full h-auto"
                  />
                </div>

                {/* Stay Connected - Floating overlay top-left */}
                <div className="absolute top-0 left-0 w-[55%] rounded-2xl overflow-hidden border-2 border-emerald-500/30 shadow-2xl shadow-black/50 z-10">
                  <img 
                    src="/creatorbios/stayconnected.png" 
                    alt="Stay connected - How fans subscribe"
                    className="w-full h-auto"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Services Section */}
        <section className="py-12 sm:py-16 relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-cyan-500/10 via-blue-500/5 to-purple-500/10 rounded-full blur-[100px]" />
          
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <p className="text-cyan-400 font-semibold uppercase tracking-widest mb-4">Services</p>
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
                Fuel your platform's{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400">
                  growth
                </span>
              </h2>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {services.map((service, index) => (
                <div
                  key={index}
                  className="group relative"
                >
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500/50 to-purple-500/50 rounded-2xl blur opacity-0 group-hover:opacity-30 transition duration-500" />
                  <div className="relative glass rounded-2xl p-8 border border-white/10 hover:border-white/20 transition-all duration-500 h-full flex flex-col items-center text-center">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                      <service.icon className="w-8 h-8 text-cyan-400" />
                    </div>
                    <h3 className="text-xl font-bold text-white">{service.title}</h3>
                    {service.comingSoon && (
                      <span className="mt-2 text-xs font-semibold text-amber-400 uppercase tracking-wider">Coming Soon</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center">
              <p className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white">
                …all with{' '}
                <span className="relative inline-block">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">zero effort</span>
                  <span className="absolute -bottom-1 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full" />
                </span>
                {' '}and already integrated into your ShoutOut dashboard.
              </p>
            </div>
          </div>
        </section>

      </div>
    </>
  );
}
