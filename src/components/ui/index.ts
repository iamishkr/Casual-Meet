// Re-export design system primitives
export * from './Button';
export * from './Input';
export * from './Card';
export { Badge as BadgePrimitive, type BadgeProps as BadgePrimitiveProps } from './Badge';
export { Modal as ModalPrimitive, type ModalProps as ModalPrimitiveProps } from './Modal';
export * from './BottomSheet';
export * from './Tabs';
export * from './Skeleton';
export * from './EmptyState';
export * from './ErrorState';
export * from './Dropdown';
export * from './Dialog';
export * from './Toast';

// Re-export classic inline UI elements for full backward compatibility
export {
  I,
  Avatar,
  Badge,
  Btn,
  Modal,
  Toggle,
  Seg,
  Reveal,
  Ring,
  Ticks,
  SectionHead,
  Empty,
  Field,
  inputCls,
  MiniBars,
} from '../ui';
