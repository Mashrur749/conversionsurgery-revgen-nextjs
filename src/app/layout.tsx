import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import { Toaster } from 'sonner';

const inter = Inter({
	variable: '--font-inter',
	subsets: ['latin'],
});

const jetbrainsMono = JetBrains_Mono({
	variable: '--font-jetbrains-mono',
	subsets: ['latin'],
});

export const metadata: Metadata = {
	title: 'ConversionSurgery',
	description: 'SMS automation for contractors',
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<head>
				<link rel="icon" href="/favicon.svg" type="image/svg+xml"></link>
			</head>
			<body className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}>
				<Providers>{children}</Providers>
				<Toaster richColors />
			</body>
		</html>
	);
}
