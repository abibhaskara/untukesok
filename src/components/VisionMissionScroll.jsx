'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

const slides = [
  {
    id: 'vision',
    title: 'VISI KAMI',
    subtext: '01',
    description: 'Menjadi katalisator perubahan yang inklusif dan berkelanjutan demi mewujudkan kualitas kehidupan yang adil, sejahtera, dan terjaga bagi generasi masa depan.',
    color: '#D9D5C9',
    textColor: '#111111',
    image: 'https://res.cloudinary.com/dnbgczi9b/image/upload/v1785086752/DSC08945-2_fbc0dt.webp'
  },
  {
    id: 'mission',
    title: 'MISI KAMI',
    subtext: '02',
    description: 'Gerakan ini memberdayakan manusia melalui pendidikan dari pelajar untuk pelajar guna menggerakkan aksi sosial, lingkungan, dan kolaborasi inklusif demi dampak masa depan yang berkelanjutan.',
    color: '#5B757A',
    textColor: '#ffffff',
    image: 'https://res.cloudinary.com/dnbgczi9b/image/upload/v1785086662/IMG_8613_gqorfr.webp'
  },
  {
    id: 'logo',
    title: 'FILOSOFI',
    subtext: '03',
    description: 'Logo ini menyatukan elemen matahari dan teks sebagai simbol komitmen komunitas untuk bertindak hari ini demi masa depan "Untuk Esok" yang lebih inklusif dan sejahtera.',
    color: '#3D3835',
    textColor: '#ffffff',
    image: '/logo_UE.webp'
  }
];

export default function VisionMissionScroll() {
  const containerRef = useRef(null);
  
  // Track scroll progress within the 300vh container
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end']
  });

  return (
    <div ref={containerRef} className="vm-scroll-container">
      <div className="vm-sticky-wrapper">
        <div className="vm-split-layout">
          
          {/* LEFT CONTENT (60%) */}
          <div className="vm-left-pane">
            <div className="vm-header">
            </div>
            
            <div className="vm-text-content">
              {slides.map((slide, index) => (
                <SlideTextItem key={slide.id} slide={slide} index={index} scrollYProgress={scrollYProgress} />
              ))}
            </div>
          </div>

          {/* RIGHT CONTENT (40%) - 3D IMAGE STACK */}
          <div className="vm-right-pane">
            <div className="vm-image-stack">
              {slides.map((slide, index) => (
                <SlideImageItem key={slide.id} slide={slide} index={index} scrollYProgress={scrollYProgress} />
              ))}
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}

function SlideTextItem({ slide, index, scrollYProgress }) {
  const opacity = useTransform(scrollYProgress, (v) => {
    const target = index * 0.5;
    const dist = Math.abs(v - target);
    if (dist >= 0.15) return 0;
    return 1 - (dist / 0.15);
  });
  
  const y = useTransform(scrollYProgress, (v) => {
    const target = index * 0.5;
    const dist = v - target;
    if (dist <= -0.2) return 100;
    if (dist >= 0.2) return -100;
    return -(dist / 0.2) * 100;
  });

  return (
    <motion.div 
      className="vm-slide-text"
      style={{ opacity, y }}
    >
      <p className="vm-subtext">{slide.subtext}</p>
      <div style={{ overflow: 'hidden' }}>
        <h2 className="vm-title">{slide.title}</h2>
      </div>
      <p className="vm-description" style={{ marginTop: '16px', fontSize: '16px', lineHeight: '1.6', opacity: 0.8, maxWidth: '480px' }}>
        {slide.description}
      </p>
    </motion.div>
  );
}

function SlideImageItem({ slide, index, scrollYProgress }) {
  const distance = useTransform(scrollYProgress, (v) => (v * 2) - index);
  
  const rotate = useTransform(distance, (d) => {
    if (d <= -1) return -8;
    if (d >= 1) return 8;
    return d * 8;
  });
  
  const scale = useTransform(distance, (d) => {
    if (d <= -1 || d >= 1) return 0.8;
    return 1 - (Math.abs(d) * 0.2);
  });
  
  const opacity = useTransform(distance, (d) => {
    if (d <= -0.5 || d >= 0.5) return 0;
    return 1 - (Math.abs(d) * 2);
  });
  
  const filter = useTransform(distance, (d) => {
    if (d <= -1 || d >= 1) return 'blur(12px)';
    return `blur(${Math.abs(d) * 12}px)`;
  });

  return (
    <motion.div
      className="vm-image-wrapper"
      style={{ rotate, scale, opacity, filter }}
    >
      <img 
        src={slide.image} 
        alt={slide.title} 
        className="vm-image" 
        style={slide.image.includes('logo') ? { objectFit: 'contain' } : {}}
      />
    </motion.div>
  );
}
