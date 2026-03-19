'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import AuthModal from '@/components/Auth/AuthModal';
import styles from './Header.module.css';

export default function Header() {
  const [user, setUser] = useState<any>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
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
          <div className={styles.userMenu}>
            <span className={styles.userEmail}>{user.email}</span>
            <button className={styles.logoutBtn} onClick={() => supabase.auth.signOut()}>
              Sair
            </button>
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
