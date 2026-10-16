import Swiper from "swiper";
import { Navigation, Pagination, Autoplay, A11y } from "swiper/modules";
window.BHSwiper = function (el, opts) { return new Swiper(el, Object.assign({ modules: [Navigation, Pagination, Autoplay, A11y] }, opts)); };
