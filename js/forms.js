/*
 * Contact form handling for the exported site.
 *
 * The Webflow export still ships webflow.js, which posts every form to
 * https://webflow.com/api/v1/form/<site-id> — an endpoint that only accepts
 * requests from Webflow-hosted domains, so submissions were being dropped.
 * This intercepts submit during the *capture* phase at the document, which
 * runs before webflow.js's delegated jQuery handler, and takes over.
 *
 * Forms opt in with data-form:
 *   data-form="contact-general"  -> posted to /api/contact
 *   data-form="contact-detailed" -> posted to /api/contact
 *   data-form="calculator"       -> never submitted; the pricing calculator
 *                                   wraps its radio buttons in a <form>, and
 *                                   submitting reloads the page and wipes the
 *                                   visitor's progress.
 */
(function () {
  'use strict'

  var ENDPOINT = '/api/contact'

  function wrapper(form) {
    var el = form.parentNode
    while (el && el !== document.body) {
      if (el.classList && el.classList.contains('w-form')) return el
      el = el.parentNode
    }
    return form.parentNode
  }

  // Reuse the markup Webflow already ships for success and failure states so
  // the styling matches the rest of the site.
  function showState(form, state) {
    var box = wrapper(form)
    var done = box.querySelector('.w-form-done')
    var fail = box.querySelector('.w-form-fail')
    if (state === 'done') {
      form.style.display = 'none'
      if (done) done.style.display = 'block'
      if (fail) fail.style.display = 'none'
    } else {
      if (fail) fail.style.display = 'block'
      if (done) done.style.display = 'none'
    }
  }

  function setBusy(button, busy) {
    if (!button) return
    if (busy) {
      button.dataset.originalValue = button.value
      if (button.dataset.wait) button.value = button.dataset.wait
      button.disabled = true
    } else {
      if (button.dataset.originalValue) button.value = button.dataset.originalValue
      button.disabled = false
    }
  }

  function submit(form) {
    var button = form.querySelector('input[type="submit"], button[type="submit"]')
    var payload = { form: form.dataset.form, page: window.location.pathname }

    Array.prototype.forEach.call(form.elements, function (field) {
      if (!field.name || field.type === 'submit') return
      if (field.type === 'checkbox') payload[field.name] = field.checked
      else if (field.type === 'radio') { if (field.checked) payload[field.name] = field.value }
      else payload[field.name] = field.value
    })

    setBusy(button, true)

    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function (res) {
        return res.json().catch(function () { return { ok: res.ok } })
      })
      .then(function (body) {
        if (body && body.ok) showState(form, 'done')
        else throw new Error((body && body.error) || 'Submission failed')
      })
      .catch(function (err) {
        console.error('Form submission failed:', err)
        showState(form, 'fail')
        setBusy(button, false)
      })
  }

  document.addEventListener(
    'submit',
    function (event) {
      var form = event.target
      if (!form || !form.dataset || !form.dataset.form) return

      // Stop webflow.js from also handling this form.
      event.preventDefault()
      event.stopPropagation()

      if (form.dataset.form === 'calculator') return
      submit(form)
    },
    true,
  )
})()
