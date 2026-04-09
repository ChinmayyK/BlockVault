import React, { useState, useEffect, useRef } from 'react';
import { Search, FileText, Lock, FileKey } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';
import { getApiBase } from '@/lib/getApiBase';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';

export function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('global-search-input')?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      if (!user?.jwt) return;
      setLoading(true);
      try {
        const res = await fetch(`${getApiBase()}/files/search?q=${encodeURIComponent(query)}&limit=8`, {
          headers: { 'Authorization': `Bearer ${user.jwt}` }
        });
        if (res.ok) {
          const data = await res.json();
          setResults(data.files || []);
          setIsOpen(true);
        }
      } catch (err) {
        console.error('Search failed', err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, user?.jwt]);

  const handleSelect = (file: any) => {
    setIsOpen(false);
    setQuery('');
    if (file.redacted_from) {
      navigate(`/dashboard?file=${file.file_id}`);
    } else {
      navigate(`/dashboard?file=${file.file_id}`);
    }
  };

  return (
    <div ref={wrapperRef} className="relative flex-1 group">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
        {loading ? (
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        ) : (
          <Search className="h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
        )}
      </div>
      <Input
        id="global-search-input"
        type="text"
        placeholder="Search documents... (Cmd+K)"
        className="pl-10 pr-4 bg-input/50 border-border/60 focus:bg-background transition-all"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => { if (results.length > 0) setIsOpen(true); }}
      />

      {isOpen && (
        <div className="absolute top-full mt-2 left-0 right-0 bg-popover border border-border/50 rounded-xl shadow-xl overflow-hidden z-50 py-2 max-h-[400px] overflow-y-auto animate-in fade-in slide-in-from-top-2">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No matching files found
            </div>
          ) : (
            <div className="flex flex-col">
              <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Files
              </div>
              {results.map((file) => (
                <button
                  key={file.file_id}
                  className="w-full text-left px-4 py-2.5 hover:bg-muted/50 transition-colors flex items-center gap-3 focus:bg-muted/50 focus:outline-none"
                  onClick={() => handleSelect(file)}
                >
                  <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${file.redacted_from ? 'bg-amber-500/10' : 'bg-primary/10'}`}>
                    {file.redacted_from ? (
                      <FileKey className="w-4 h-4 text-amber-500" />
                    ) : (
                      <FileText className="w-4 h-4 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {file.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                      <span>{formatDistanceToNow(new Date(file.created_at * 1000))} ago</span>
                      {file.workspace_id && (
                        <>
                          <span className="w-1 h-1 rounded-full bg-border" />
                          <span className="text-primary truncate">Workspace</span>
                        </>
                      )}
                    </div>
                  </div>
                  {file.redacted_from && (
                    <Lock className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0 ml-2" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
