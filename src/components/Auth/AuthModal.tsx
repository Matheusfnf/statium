'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import styles from './AuthModal.module.css';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createClient();

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        onClose();
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        alert('Cadastro realizado! Se configurado, verifique seu e-mail, senão já pode fazer login.');
        setIsLogin(true);
      }
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.titleWrapper}>
            <div className={styles.logoIcon}>S</div>
            <div>
              <h2 className={styles.title}>{isLogin ? 'Bem-vindo de volta' : 'Criar Conta'}</h2>
              <p className={styles.subtitle}>{isLogin ? 'Faça login para continuar' : 'Comece a analisar seus dados'}</p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} type="button" title="Fechar">✕</button>
        </div>
        
        <form className={styles.form} onSubmit={handleSubmit}>
          {error && <div className={styles.error}>{error}</div>}
          
          <div className={styles.field}>
            <label>E-mail</label>
            <input 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              required 
              autoFocus
              placeholder="seu@email.com"
              className={styles.input}
            />
          </div>
          
          <div className={styles.field}>
            <label>Senha</label>
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
              placeholder="••••••••"
              className={styles.input}
            />
          </div>
          
          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? 'Aguarde...' : (isLogin ? 'Entrar' : 'Cadastrar')}
          </button>
          
          <div className={styles.footer}>
            {isLogin ? (
              <p>
                Ainda não tem conta?{' '}
                <button type="button" onClick={() => setIsLogin(false)} className={styles.linkBtn}>
                  Cadastre-se
                </button>
              </p>
            ) : (
              <p>
                Já possui conta?{' '}
                <button type="button" onClick={() => setIsLogin(true)} className={styles.linkBtn}>
                  Faça login
                </button>
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
