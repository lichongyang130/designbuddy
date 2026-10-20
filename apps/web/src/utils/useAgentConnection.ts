import { useEffect } from 'react';

export function useAgentConnection() {
  useEffect(() => {
    const host = window.location.hostname;
    // We assume agent-daemon runs on 4124
    const url = `http://${host}:4124/events`;
    
    let source: EventSource | null = null;
    
    try {
      source = new EventSource(url);
      source.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.action === 'update_data') {
            window.dispatchEvent(new CustomEvent('buddy:agent-update-data', { detail: data.payload }));
          } else if (data.action === 'run_skill') {
            window.dispatchEvent(new CustomEvent('buddy:run-skill', { detail: data.payload }));
          } else if (data.action === 'apply_theme') {
            window.dispatchEvent(new CustomEvent('buddy:apply-theme', { detail: data.payload }));
          }
        } catch (err) {
          console.error("Agent message parse error:", err);
        }
      };
      
      source.onerror = () => {
        // Silent reconnect
      };
    } catch (e) {
      console.warn("Could not connect to Agent Daemon", e);
    }
    
    return () => {
      if (source) source.close();
    };
  }, []);
}
