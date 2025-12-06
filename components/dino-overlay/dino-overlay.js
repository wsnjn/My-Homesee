Component({
    data: {
        isJumping: false
    },
    methods: {
        makeDinoJump() {
            if (!this.data.isJumping) {
                this.setData({
                    isJumping: true
                });
                setTimeout(() => {
                    this.setData({
                        isJumping: false
                    });
                }, 600);
            }
        }
    }
});
