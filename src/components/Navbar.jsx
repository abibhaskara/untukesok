'use client';

import { useState, useEffect, useRef, memo } from 'react';
import { motion } from 'framer-motion';
import { FiUser, FiCalendar, FiHome } from 'react-icons/fi';
import { IoNewspaperOutline } from 'react-icons/io5';
import { usePathname, useRouter } from 'next/navigation';

const navItems = [
  { label: 'Beranda', path: '/', icon: FiHome },
  { label: 'Berita', path: '/berita', icon: IoNewspaperOutline },
  { label: 'Kegiatan', path: '/kegiatan', icon: FiCalendar },
  { label: 'Akun', path: '/akun', icon: FiUser }
];

const Navbar = () => {
  const navbarRef = useRef(null);
  const pathname = usePathname();
  const router = useRouter();

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

  const activeHoverOffset = pathname ? getHoverOffset(pathname) : 0;
  const isActiveHovered = hoveredPath === pathname;

  useEffect(() => {
    const updatePill = () => {
      const activeEl = navbarRef.current?.querySelector(`.nav-link-btn[data-path="${pathname}"]`);
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

    requestAnimationFrame(updatePill);

    // ponytail: ResizeObserver replaces 30-frame rAF polling loop
    const ro = new ResizeObserver(() => requestAnimationFrame(updatePill));
    if (navbarRef.current) ro.observe(navbarRef.current);
    window.addEventListener('resize', updatePill);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updatePill);
    };
  }, [pathname, isMobile, hoveredPath]);

  const handleNavClick = (path) => {
    router.push(path);
    window.scrollTo(0, 0);
  };

  // Hide floating navbar on admin pages or program detail pages
  if (pathname?.startsWith('/admin') || (pathname?.startsWith('/kegiatan/') && pathname !== '/kegiatan')) {
    return null;
  }

  return (
    <div className="navbar-container">
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
          const isActive = pathname === item.path;

          return (
            <div
              key={item.path}
              className={`nav-link-btn ${isActive ? 'nav-link active' : 'nav-link'}`}
              data-path={item.path}
              onClick={() => handleNavClick(item.path)}
              onMouseEnter={() => {
                setHoveredPath(item.path);
                router.prefetch(item.path); // ponytail: prefetch on hover, built-in Next.js
              }}
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
    </div>
  );
};

export default memo(Navbar);
