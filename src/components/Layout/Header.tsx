'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import AuthModal from '@/components/Auth/AuthModal';
import styles from './Header.module.css';

export default function Header() {
  const [user, setUser] = useState<any>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className={styles.header}>
      <Link href="/" className={styles.logo}>
        <span className={styles.logoIcon}>S</span>
        <span className="gradient-text">Statium</span>
      </Link>

      <nav className={styles.nav}>
        <Link href="/#features" className={styles.navLink}>
          Recursos
        </Link>
        <Link href="/#how-it-works" className={styles.navLink}>
          Como Funciona
        </Link>
        <Link href="/analysis" className={styles.ctaButton}>
          Iniciar Análise
        </Link>

        {user ? (
          <div className={styles.userMenu} ref={menuRef}>
            <button 
              className={styles.profileBtn}
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <div className={styles.avatar}>
                {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
              </div>
            </button>
            {isMenuOpen && (
              <div className={styles.dropdown}>
                <div className={styles.dropdownHeader}>
                  <div className={styles.dropdownEmail}>{user.email}</div>
                </div>
                <div className={styles.dropdownDivider}></div>
                <Link href="/history" className={styles.dropdownItem} onClick={() => setIsMenuOpen(false)}>
                  <span className={styles.dropdownIcon}>⭐</span>
                  Meus Favoritos
                </Link>
                <button 
                  className={styles.dropdownItem} 
                  onClick={() => {
                    supabase.auth.signOut();
                    setIsMenuOpen(false);
                  }}
                >
                  <span className={styles.dropdownIcon}>🚪</span>
                  Sair
                </button>
              </div>
            )}
          </div>
        ) : (
          <button className={styles.loginBtn} onClick={() => setIsAuthOpen(true)}>
            Entrar
          </button>
        )}
      </nav>

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </header>
  );
}
