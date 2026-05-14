import React from 'react';
import { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  description?: string;
  icon: any; // Can be a LucideIcon or a ReactNode
  actions?: React.ReactNode;
  rightElement?: React.ReactNode;
  badge?: string;
}

export const PageHeader = ({ title, subtitle, description, icon, actions, rightElement, badge }: PageHeaderProps) => {
  const renderIcon = () => {
    if (!icon) return null;
    try {
      if (React.isValidElement(icon)) {
        return React.cloneElement(icon as React.ReactElement, { className: 'w-6 h-6' } as any);
      }
      
      const IconComp = icon;
      if (typeof IconComp === 'function' || typeof IconComp === 'object') {
        return <IconComp className="w-6 h-6" />;
      }
    } catch (e) {
      console.error('[PageHeader] Icon render error:', e);
    }
    return null;
  };

  const subText = subtitle || description;

  return (
    <header className="pb-3 pt-1">
      <div className="w-full flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* Icon with Gradient Background */}
          {icon && (
            <div className="w-14 h-14 rounded-[20px] bg-primary flex items-center justify-center text-on-primary shadow-2xl shadow-primary/20 flex-shrink-0 border border-white/10 relative overflow-hidden group">
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              {renderIcon()}
            </div>
          )}

          {/* Title and Subtitle Area */}
          <div className="flex flex-col">
            {badge && (
              <div className="inline-flex items-center w-fit px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.2em] bg-primary/5 text-primary border border-primary/10 mb-2">
                {badge}
              </div>
            )}
            <h1 className="text-2xl md:text-3xl font-headline font-black text-on-surface tracking-tight leading-none uppercase">
              {title}
            </h1>
            {subText && (
              <p className="text-[10px] font-headline font-black text-primary/40 uppercase tracking-[0.2em] mt-2">
                {subText}
              </p>
            )}
          </div>
        </div>

        {/* Optional Actions and Elements */}
        {(actions || rightElement) && (
          <div className="flex flex-wrap items-center gap-3">
            {actions && (
              <div className="flex items-center bg-white/50 backdrop-blur-xl p-1.5 rounded-2xl border border-outline-variant/10 shadow-2xl shadow-primary/5">
                {actions}
              </div>
            )}
            {rightElement && (
              <div className="flex items-center">
                {rightElement}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
