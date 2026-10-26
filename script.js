'use strict';

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

// Header for mobile screens
const navToggle = $('.nav-toggle');
const mainNav = $('#main-nav');
navToggle.addEventListener('click', () => {
  const isOpen = mainNav.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', String(isOpen));
  navToggle.setAttribute('aria-label', isOpen ? 'Đóng menu' : 'Mở menu');
});
$$('#main-nav a').forEach(link => link.addEventListener('click', () => {
  mainNav.classList.remove('open');
  navToggle.setAttribute('aria-expanded', 'false');
}));

function updateDots(selector, index) {
  $$(selector).forEach((btn, i) => {
    btn.classList.toggle('active', i === index);
    if (i === index) btn.setAttribute('aria-current', 'true');
    else btn.removeAttribute('aria-current');
  });
}
function attachSlider({items, render, prev, next, dots}) {
  let current = 0;
  function goTo(i) {
    current = (i + items.length) % items.length;
    render(items[current], current);
    if (dots) updateDots(dots, current);
  }
  $(prev).addEventListener('click', () => goTo(current - 1));
  $(next).addEventListener('click', () => goTo(current + 1));
  if (dots) $$(dots).forEach((button, i) => button.addEventListener('click', () => goTo(i)));
  return { goTo, getCurrent: () => current };
}

const heroSlides = [
  {eyebrow:'MỘT GÓC CHẠM HƯƠNG CÀ PHÊ', title:'Tinh hoa<br><em>từ hạt,</em>', desc:'Hương vị quen thuộc, trong một không gian thật khác.', img:'assets/hero-coffee.png', alt:false},
  {eyebrow:'NHẸ NHÀNG MỘT CHÚT MỖI NGÀY', title:'Một chút<br><em>tươi xanh,</em>', desc:'Một ly trà dịu mát, thêm cảm hứng cho ngày mới.', img:'assets/matcha.png', alt:true},
  {eyebrow:'HƯƠNG VỊ CHO NHỮNG CUỘC HẸN', title:'Gặp nhau<br><em>ở HAMIE,</em>', desc:'Thưởng thức đồ uống tươi mát trong góc nhỏ thân quen.', img:'assets/orange-tea.png', alt:true}
];
attachSlider({
  items: heroSlides, prev:'#hero-prev', next:'#hero-next', dots:'#hero-dots .dot',
  render: (slide) => {
    $('#hero-eyebrow').textContent = slide.eyebrow;
    $('#hero-title').innerHTML = slide.title; // Only static, locally authored strings
    $('#hero-desc').textContent = slide.desc;
    const img = $('#hero-image');
    img.src = slide.img;
    img.classList.toggle('is-alt',slide.alt);
    $('.hero-visual').classList.toggle('is-alt',slide.alt);
    $('#hero-secondary-caption').hidden = !slide.alt;
  }
});

const spaces = [
  {tag:'KHÔNG GIAN HAMIE',title:'Không gian mát lành',desc:'Một chỗ ngồi thoải mái, để bạn ở lại lâu hơn.',img:'assets/cozy-space.png'},
  {tag:'GÓC NHỎ HAMIE',title:'Một góc dành riêng cho bạn',desc:'Một khoảng riêng tư để đọc sách hoặc làm việc.',img:'assets/hamie-story.png'},
  {tag:'HẸN NHAU Ở HAMIE',title:'Chậm lại và tận hưởng',desc:'Một không gian ấm áp cho những cuộc hẹn thân quen.',img:'assets/cozy-space.png'}
];
let selectedSpace = 0;
attachSlider({
  items:spaces,prev:'#space-prev',next:'#space-next',
  render:(slide,i)=>{
    selectedSpace=i;
    $('#space-label').textContent=slide.tag;
    $('#space-title').textContent=slide.title;
    $('#space-desc').textContent=slide.desc;
    $('#space-image').src=slide.img;
  }
});

const stories = [
  {tag:'GÓC HAMIE / CHUYỆN KỂ',title:'Một khoảng lặng giữa hương cà phê',desc:'Một ly cà phê cho buổi sáng yên bình.',img:'assets/hamie-story.png'},
  {tag:'GÓC HAMIE / CẢM HỨNG',title:'Hẹn nhau một ngày thật xanh',desc:'Chia sẻ một chút bình yên ở nơi quen thuộc.',img:'assets/cozy-space.png'},
  {tag:'GÓC HAMIE / HƯƠNG VỊ',title:'Niềm vui từ những điều giản dị',desc:'Câu chuyện nhỏ bên một ly nước ngon.',img:'assets/hamie-story.png'},
  {tag:'GÓC HAMIE / GẶP GỠ',title:'Những cuộc hẹn không vội vã',desc:'Ở lại thêm một chút cho câu chuyện dài hơn.',img:'assets/cozy-space.png'},
  {tag:'GÓC HAMIE / CHUYỆN KỂ',title:'Bình yên trong một góc nhỏ',desc:'Một nơi để tạm gác lại nhịp sống bận rộn.',img:'assets/hamie-story.png'}
];
let selectedStory = 0;
attachSlider({
  items:stories,prev:'#story-prev',next:'#story-next',dots:'#story-dots .dot',
  render:(slide,i)=>{
    selectedStory=i;
    $('#story-label').textContent=slide.tag;
    $('#story-title').textContent=slide.title;
    $('#story-desc').textContent=slide.desc;
    $('#story-image').src=slide.img;
  }
});

const modal = $('#info-modal');
const modalContent = $('#modal-content');
function openModal(type) {
  const details = {
    contact: {
      tag: 'KẾT NỐI VỚI HAMIE', title: 'Liên hệ và địa chỉ HAMIE',
      html: '<p>Thông tin số điện thoại, địa chỉ và đường dẫn Facebook/Zalo chưa có trong ảnh Figma bạn cung cấp. Bạn có thể bổ sung thông tin thật vào phần này khi gửi trang Liên hệ.</p>'
    },
    menu: {
      tag:'MENU HAMIE',title:'Những món được yêu thích',
      html:'<p>Đây là các nhóm đồ uống xuất hiện trên bản thiết kế. Danh sách món đầy đủ và giá bán sẽ được thêm khi bạn cung cấp trang Thực đơn.</p><div class="modal-menu"><div><img src="assets/coffee.png" alt="Cà phê"><p>Cà phê</p></div><div><img src="assets/matcha.png" alt="Trà sữa và trà"><p>Trà sữa &amp; trà</p></div><div><img src="assets/orange-tea.png" alt="Trái cây"><p>Trái cây &amp; đá xay</p></div></div>'
    },
    offers: {
      tag:'ƯU ĐÃI & SỰ KIỆN',title:'Sắp có tin mới',
      html:'<p>Những chương trình ưu đãi và sự kiện mới sẽ được HAMIE cập nhật tại đây.</p>'
    },
    story: {
      tag:stories[selectedStory].tag,title:stories[selectedStory].title,
      html:'<p>'+stories[selectedStory].desc+'</p><p>Nội dung bài viết đầy đủ sẽ được bổ sung khi có thiết kế và nội dung trang Góc HAMIE.</p>'
    },
    space: {
      tag:spaces[selectedSpace].tag,title:spaces[selectedSpace].title,
      html:'<p>'+spaces[selectedSpace].desc+'</p><img src="'+spaces[selectedSpace].img+'" alt="Minh họa không gian HAMIE" style="width:100%;max-height:350px;object-fit:cover;border-radius:15px;margin-top:18px">'
    }
  };
  const info = details[type] || details.contact;
  $('#modal-tag').textContent=info.tag;
  $('#modal-heading').textContent=info.title;
  modalContent.innerHTML=info.html; // Only local, trusted strings above
  if (type === 'contact' && window.HAMIE_CONTENT) {
    const settings = window.HAMIE_CONTENT.settings;
    modalContent.replaceChildren();
    [settings.address, settings.hours, settings.phone].filter(Boolean).forEach(text => {
      const paragraph = document.createElement('p');
      paragraph.textContent = text;
      modalContent.append(paragraph);
    });
    const link = document.createElement('a');
    link.href = 'lien-he.html';
    link.className = 'btn btn-dark';
    link.textContent = 'Gửi lời nhắn';
    modalContent.append(link);
  }
  modal.showModal();
}
$$('[data-modal]').forEach(btn=>btn.addEventListener('click',()=>openModal(btn.dataset.modal)));
$('#modal-close').addEventListener('click',()=>modal.close());
$('#modal-done').addEventListener('click',()=>modal.close());
modal.addEventListener('click', (event) => {
  if (event.target===modal) modal.close();
});
