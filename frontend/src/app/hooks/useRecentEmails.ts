import { useState, useEffect } from 'react';

const RECENT_EMAILS_KEY = 'pramodhotels_recent_cc_emails';

export function useRecentEmails() {
  const [recentEmails, setRecentEmails] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_EMAILS_KEY);
      if (stored) {
        setRecentEmails(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load recent emails from local storage', e);
    }
  }, []);

  const addEmail = (emailStr: string) => {
    if (!emailStr) return;
    
    // Handle comma separated emails
    const emails = emailStr.split(',').map(e => e.trim()).filter(Boolean);
    if (emails.length === 0) return;

    setRecentEmails(prev => {
      const newEmails = [...prev];
      let changed = false;
      
      emails.forEach(email => {
        if (!newEmails.includes(email)) {
          newEmails.push(email);
          changed = true;
        }
      });

      if (changed) {
        try {
          localStorage.setItem(RECENT_EMAILS_KEY, JSON.stringify(newEmails));
        } catch (e) {
          console.error('Failed to save recent emails to local storage', e);
        }
        return newEmails;
      }
      return prev;
    });
  };

  return { recentEmails, addEmail };
}
