import './globals.css';

export const metadata = {
  title: 'Open Jules — Verified Coding Workspace',
  description: 'Authenticated Jules coding sessions, review and evidence',
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
