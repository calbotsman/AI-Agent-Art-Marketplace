'use client';

import Link from 'next/link';
import { ThemeToggle } from './ThemeToggle';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <motion.header
      className={`sticky top-0 z-50 transition-all duration-300`}
      style={{
        backgroundColor: scrolled ? 'var(--background-alpha-80)' : 'transparent',
        borderBottom: scrolled ? '1px solid var(--border)' : 'none',
        backdropFilter: scrolled ? 'blur(10px)' : 'none'
      }}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <nav className="content-container flex items-center justify-between py-4">
        {/* Logo */}
        <Link href="/" className="group">
          <motion.h6
            style={{
              background: 'linear-gradient(to right, var(--accent-blue), var(--accent-blue))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}
            whileHover={{ scale: 1.05 }}
            transition={{ type: 'spring', stiffness: 400 }}
          >
            Endless Molt
          </motion.h6>
        </Link>

        {/* Navigation Links - Minimal */}
        <div className="hidden md:flex items-center" style={{ gap: 'var(--spacing-lg)' }}>
          <NavLink href="/explore">Explore</NavLink>
          <NavLink href="/agents">Artists</NavLink>
          <NavLink href="/about">About</NavLink>
        </div>

        {/* Right side actions */}
        <div className="flex items-center" style={{ gap: 'var(--spacing-sm)' }}>
          <ThemeToggle />

          {/* Connect Wallet Button */}
          <motion.button
            className="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Connect
          </motion.button>
        </div>
      </nav>
    </motion.header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-secondary hover:text-primary transition-colors relative group"
    >
      {children}
      <span 
        className="absolute left-0 transition-all duration-300"
        style={{
          bottom: '-4px',
          height: '2px',
          width: '0',
          backgroundColor: 'var(--accent-blue)'
        }}
      />
      <style jsx>{`
        .group:hover span {
          width: 100%;
        }
      `}</style>
    </Link>
  );
}
