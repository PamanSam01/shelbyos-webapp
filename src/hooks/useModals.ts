import { useState } from 'react';

export function useModals() {
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isPermModalOpen, setIsPermModalOpen] = useState(false);
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);
  const [isFundModalOpen, setIsFundModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isUploadDetailModalOpen, setIsUploadDetailModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isAccessDeniedOpen, setIsAccessDeniedOpen] = useState(false);
  const [returnToUpload, setReturnToUpload] = useState(false);

  return {
    isWalletModalOpen,
    setIsWalletModalOpen,
    isPermModalOpen,
    setIsPermModalOpen,
    isConfirmClearOpen,
    setIsConfirmClearOpen,
    isFundModalOpen,
    setIsFundModalOpen,
    isDetailModalOpen,
    setIsDetailModalOpen,
    isUploadDetailModalOpen,
    setIsUploadDetailModalOpen,
    isPreviewModalOpen,
    setIsPreviewModalOpen,
    isAccessDeniedOpen,
    setIsAccessDeniedOpen,
    returnToUpload,
    setReturnToUpload,
  };
}
