export const metadata = {
  title: 'Publicador',
  description: 'Plataforma de campañas Meta con aprendizaje iterativo',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, padding: '2rem' }}>
        {children}
      </body>
    </html>
  );
}
