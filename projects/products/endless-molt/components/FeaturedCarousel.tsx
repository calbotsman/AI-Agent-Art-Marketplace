'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { formatMicroEth } from '@/lib/pricing';

interface FeaturedItem {
  id: string;
  title: string;
  artist?: string;
  agent?: { name: string };
  image?: string;
  image_url?: string | null;
  thumbnail_url?: string | null;
  price?: number;
  type?: 'auction' | 'listing';
}

interface FeaturedCarouselProps {
  items: FeaturedItem[];
}

export function FeaturedCarousel({ items }: FeaturedCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  // Auto-advance carousel
  useEffect(() => {
    const timer = setInterval(() => {
      setDirection(1);
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [items.length]);

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 1000 : -1000,
      opacity: 0,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 1000 : -1000,
      opacity: 0,
    }),
  };

  const swipeConfidenceThreshold = 10000;
  const swipePower = (offset: number, velocity: number) => {
    return Math.abs(offset) * velocity;
  };

  const paginate = (newDirection: number) => {
    setDirection(newDirection);
    setCurrentIndex((prev) => {
      let next = prev + newDirection;
      if (next >= items.length) next = 0;
      if (next < 0) next = items.length - 1;
      return next;
    });
  };

  if (!items || items.length === 0) {
    return null;
  }

  const current = items[currentIndex];
  const imageUrl = current.image || current.image_url || current.thumbnail_url || '';
  const artistName = current.artist || (current.agent?.name) || 'Unknown Artist';
  const priceETH = current.price !== undefined && current.price !== null ? formatMicroEth(current.price) : '';

  return (
    <div 
      className="relative w-full h-[600px] rounded-2xl overflow-hidden"
      style={{ backgroundColor: 'var(--surface)' }}
    >
      <AnimatePresence initial={false} custom={direction}>
        <motion.div
          key={currentIndex}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            x: { type: 'spring', stiffness: 300, damping: 30 },
            opacity: { duration: 0.2 },
          }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={1}
          onDragEnd={(e, { offset, velocity }) => {
            const swipe = swipePower(offset.x, velocity.x);

            if (swipe < -swipeConfidenceThreshold) {
              paginate(1);
            } else if (swipe > swipeConfidenceThreshold) {
              paginate(-1);
            }
          }}
          className="absolute inset-0"
        >
          {/* Image Background */}
          <div className="relative w-full h-full">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={current.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: 'var(--surface)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>No Image</span>
              </div>
            )}
            {/* Gradient Overlay */}
            <div 
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(to top, var(--background), transparent)'
              }}
            />
          </div>

          {/* Content */}
          <div 
            className="absolute bottom-0 left-0 right-0"
            style={{ padding: 'var(--spacing-xl)' }}
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="max-w-2xl"
            >
              <div 
                className="inline-block px-3 py-1 rounded-full text-sm mb-4"
                style={{ 
                  backgroundColor: 'rgba(60, 75, 154, 0.2)',
                  backdropFilter: 'blur(10px)',
                  color: 'white'
                }}
              >
                {current.type === 'auction' ? '🔥 Live Auction' : '✨ Featured'}
              </div>

              <h2 
                className="mb-3 text-white"
                style={{ fontSize: '3rem', fontWeight: '300' }}
              >
                {current.title}
              </h2>

              <p 
                className="text-xl mb-6"
                style={{ color: 'rgba(255, 255, 255, 0.8)' }}
              >
                by {artistName}
              </p>

              {priceETH && (
                <p 
                  className="text-3xl mb-8"
                  style={{ color: 'white', fontWeight: '400' }}
                >
                  {priceETH} ETH
                </p>
              )}

              <Link
                href={`/${current.type === 'auction' ? 'auctions' : 'listings'}/${current.id}`}
                className="button"
                style={{ display: 'inline-block' }}
              >
                View {current.type === 'auction' ? 'Auction' : 'Artwork'}
              </Link>
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation Arrows */}
      <button
        onClick={() => paginate(-1)}
        className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center transition-colors z-10"
        style={{ 
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(10px)'
        }}
        aria-label="Previous"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <button
        onClick={() => paginate(1)}
        className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center transition-colors z-10"
        style={{ 
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(10px)'
        }}
        aria-label="Next"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Dots Indicator */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        {items.map((_, index) => (
          <button
            key={index}
            onClick={() => {
              setDirection(index > currentIndex ? 1 : -1);
              setCurrentIndex(index);
            }}
            className={`h-2 rounded-full transition-all ${
              index === currentIndex ? 'w-8' : 'w-2'
            }`}
            style={{
              backgroundColor: index === currentIndex 
                ? 'var(--accent-blue)' 
                : 'rgba(255, 255, 255, 0.5)'
            }}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
