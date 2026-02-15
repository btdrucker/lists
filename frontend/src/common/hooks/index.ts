import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../store.ts';

// Use throughout your app instead of plain `useDispatch` and `useSelector`
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();

export { useAutoHeight } from './useAutoHeight.ts';
export { useDebugMode } from './useDebugMode.ts';
export { useNavigateWithDebug, appendDebugToPath } from './useNavigateWithDebug.ts';
export { useOnlineStatus } from './useOnlineStatus.ts';
export { usePWAInstall } from './usePWAInstall.ts';
export { useWakeLock } from './useWakeLock.ts';
