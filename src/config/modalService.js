import { Modal } from 'antd'

class ModalService {
  constructor() {
    this.modalInstance = null
  }

  info(options) {
    if (this.modalInstance) {
      this.modalInstance.destroy()
    }
    this.modalInstance = Modal.info({
      ...options,
      onClose: () => {
        this.modalInstance = null
        if (options.onClose && typeof options.onClose === 'function') {
          options.onClose()
        }
      },
    })
    return this.modalInstance
  }
}

const modalService = new ModalService()
export default modalService
