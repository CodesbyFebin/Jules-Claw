export const metadata = {
  title: 'Open Jules',
  description: 'Asynchronous coding agent powered by Jules',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif', background: '#0a0c10', color: '#e6edf3' }}>
        {children}
      </body>
    </html>
  );
}
