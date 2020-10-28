
<template>
  <div
    class="apos-avatar"
    :style="style" :alt="alt"
  >
    <span>{{ initials }}</span>
  </div>
</template>

<script>
export default {
  name: 'AposAvatar',
  props: {
    user: {
      type: Object,
      required: true
    },
    size: {
      type: String,
      default: null
    },
    alt: {
      type: String,
      default: ''
    }
  },
  data() {
    return {};
  },
  computed: {
    style() {
      const backgroundImages = [
        'linear-gradient(46deg, #CC9300 0%, #EA433A 26%, #B327BF 47%, #6666FF 76%, #00BF9A 100%)',
        'linear-gradient(46deg, #00BF9A 0%, #CC9300 47%, #EA433A 100%)',
        'linear-gradient(46deg, #EB4339 0%, #B327BF 47%, #6666FE 100%)',
        'linear-gradient(46deg, #6666FF 0%, #00BF9A 47%, #CC9300 100%)',
        'linear-gradient(46deg, #CC9300 0%, #EA433A 47%, #B327BF 100%)',
        'linear-gradient(46deg, #B327BF 0%, #6666FF 47%, #00C09A 100%)'
      ];
      const index = parseInt(this.user._id, 36) % backgroundImages.length;
      return {
        'background-image': backgroundImages[index],
        width: this.size
      };
    },
    initials() {
      let initials = (this.user.firstName || this.user.title || this.user.username).substring(0, 1);
      if (this.user.lastName) {
        initials += this.user.lastName.substring(0, 1);
      }
      return initials;
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-avatar {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 30px;
    height: 30px;
    border: 1px solid var(--a-base-9);
    border-radius: 100%;
    /* stylelint-disable */
    line-height: 30px;
    /* stylelint-enable */
    color: var(--a-white);
    text-transform: uppercase;
  }
</style>
