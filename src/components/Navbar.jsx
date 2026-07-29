'use client';

import { useState, useEffect, useRef, memo } from 'react';
import { motion, LayoutGroup } from 'framer-motion';
import { FiUser, FiCalendar, FiHome } from 'react-icons/fi';
import { IoNewspaperOutline } from 'react-icons/io5';
import { usePathname, useRouter } from 'next/navigation';

const navItems = [
  { label: 'Beranda', path: '/', icon: FiHome },
  { label: 'Berita', path: '/news', icon: IoNewspaperOutline },
  { label: 'Program', path: '/programs', icon: FiCalendar },
  { label: 'Akun', path: '/account', icon: FiUser }
];

const Navbar = () => {
  const navbarRef = useRef(null);
  const pathname = usePathname();
  const router = useRouter();
  
  const activePath = pathname;

  // State for persistent active pill local coordinates
  const [pillStyle, setPillStyle] = useState({ left: 0, width: 0, top: 0, height: 0, opacity: 0 });
  const [hoveredPath, setHoveredPath] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const getHoverOffset = (path) => {
    if (!hoveredPath) return 0;
    const items = navItems.map(i => i.path);
    const hoveredIndex = items.indexOf(hoveredPath);
    const currentIndex = items.indexOf(path);
    if (currentIndex < hoveredIndex) return -4;
    if (currentIndex > hoveredIndex) return 4;
    return 0;
  };

  const activeHoverOffset = activePath ? getHoverOffset(activePath) : 0;
  const isActiveHovered = hoveredPath === activePath;

  // Measure active DOM element position
  useEffect(() => {
    const updatePill = () => {
      const activeEl = navbarRef.current?.querySelector(`.nav-link-btn[data-path="${activePath}"]`);
      if (activeEl) {
        setPillStyle({
          left: activeEl.offsetLeft,
          width: activeEl.offsetWidth,
          top: activeEl.offsetTop,
          height: activeEl.offsetHeight,
          opacity: 1
        });
      } else {
        setPillStyle(prev => ({ ...prev, opacity: 0 }));
      }
    };

    updatePill();

    let frameId;
    let count = 0;
    const tick = () => {
      updatePill();
      count++;
      if (count < 30) {
        frameId = requestAnimationFrame(tick);
      }
    };
    frameId = requestAnimationFrame(tick);

    window.addEventListener('resize', updatePill);
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', updatePill);
    };
  }, [activePath, isMobile, hoveredPath]);

  const handleNavClick = (path) => {
    router.push(path);
    window.scrollTo(0, 0);
  };

  // Hide floating navbar on program detail page AFTER all hooks run
  if (activePath && activePath.startsWith('/programs/') && activePath !== '/programs') {
    return null;
  }

  return (
    <div className="navbar-container">
      <LayoutGroup>
        <motion.nav
          ref={navbarRef}
          className="navbar"
          onMouseLeave={() => setHoveredPath(null)}
        >
          {/* PERSISTENT ACTIVE PILL */}
          {pillStyle.opacity > 0 && (
            <motion.div
              className="active-pill"
              animate={{
                left: pillStyle.left,
                width: pillStyle.width,
                top: pillStyle.top,
                height: pillStyle.height,
                x: activeHoverOffset,
                scale: isActiveHovered ? 1.03 : 1
              }}
              transition={{ type: "tween", duration: 0.2, ease: "easeOut" }}
              style={{
                position: 'absolute',
                opacity: pillStyle.opacity,
                pointerEvents: 'none',
                zIndex: 0
              }}
            />
          )}

          {navItems.map((item) => {
            const offset = getHoverOffset(item.path);
            const isHovered = hoveredPath === item.path;
            const isActive = activePath === item.path;
            
            return (
              <div
                key={item.path}
                className={`nav-link-btn ${isActive ? 'nav-link active' : 'nav-link'}`}
                data-path={item.path}
                onClick={() => handleNavClick(item.path)}
                onMouseEnter={() => setHoveredPath(item.path)}
                style={{ cursor: 'pointer' }}
              >
                <motion.div
                  className="nav-item-content"
                  animate={{
                    x: offset,
                    scale: isHovered ? 1.03 : 1
                  }}
                  whileTap={{ 
                    scale: 0.98, 
                    filter: "blur(0px)",
                    transition: { duration: 0.05 }
                  }}
                  transition={{ type: "tween", duration: 0.2, ease: "easeOut" }}
                >
                  <item.icon />
                  <motion.span
                    className="nav-label"
                    animate={{
                      width: isMobile ? (isActive ? "auto" : 0) : "auto",
                      opacity: isMobile ? (isActive ? 1 : 0) : 1,
                      marginLeft: isMobile ? (isActive ? 8 : 0) : 8
                    }}
                    transition={{ type: "tween", duration: 0.2, ease: "easeOut" }}
                    style={{ overflow: "hidden", whiteSpace: "nowrap" }}
                  >
                    {item.label}
                  </motion.span>
                </motion.div>
              </div>
            );
          })}
        </motion.nav>
      </LayoutGroup>
    </div>
  );
};

export default memo(Navbar);
