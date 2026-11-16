import { DataError } from './repository.ts';

const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const MAX_BYTES = 8 * 1024 * 1024;

export function validateImage(file: File) {
	if (!ALLOWED.has(file.type)) {
		throw new DataError('Use a PNG, JPEG, WebP, or GIF.');
	}
	if (file.size > MAX_BYTES) {
		throw new DataError('Images need to be 8 MB or smaller.');
	}
}

export function extensionFor(file: File) {
	const fromName = file.name
		.split('.')
		.pop()
		?.toLowerCase()
		.replace(/[^a-z0-9]/g, '');
	if (fromName && fromName.length <= 5) return fromName;
	if (file.type === 'image/png') return 'png';
	if (file.type === 'image/webp') return 'webp';
	if (file.type === 'image/gif') return 'gif';
	return 'jpg';
}

export function imageFileFromTransfer(data: DataTransfer | null) {
	if (!data) return null;
	return [...data.files].find((file) => file.type.startsWith('image/')) ?? null;
}

export async function imageFileFromClipboard() {
	if (!navigator.clipboard?.read) {
		throw new DataError(
			'This browser cannot paste screenshots. Choose a picture instead.',
		);
	}
	let items: ClipboardItem[];
	try {
		items = await navigator.clipboard.read();
	} catch {
		throw new DataError(
			'Clipboard access was blocked. Paste with the keyboard, or choose a picture.',
		);
	}
	for (const item of items) {
		const type = item.types.find((entry) => entry.startsWith('image/'));
		if (!type) continue;
		const blob = await item.getType(type);
		const subtype = type.slice('image/'.length).toLowerCase();
		const extension =
			subtype === 'jpeg' ? 'jpg' : subtype.replace(/[^a-z0-9]/g, '') || 'png';
		return new File([blob], `screenshot.${extension}`, { type });
	}
	return null;
}

export function readDataUrl(file: File) {
	return new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result));
		reader.onerror = () =>
			reject(reader.error ?? new DataError('Could not read that image.'));
		reader.readAsDataURL(file);
	});
}
