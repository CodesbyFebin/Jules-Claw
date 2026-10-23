import './globals.css';

export const metadata = {
  title: 'Open Web LLM — Local-First AI Control Plane',
  description: 'Open Web LLM by CodesbyFebin: private agent operations, coding sessions, approvals, verification jobs and evidence',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif', background: '#0a0818', color: '#f0eef6' }}>
        {children}
      </body>
    </html>
  );
}
