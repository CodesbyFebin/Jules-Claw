import './globals.css';

export const metadata = {
  title: 'Jules Claw — Autonomous Coding Control Plane',
  description: 'Jules Claw by CodesbyFebin: manage real Google Jules coding sessions, plans, pull requests, verification jobs and evidence',
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
